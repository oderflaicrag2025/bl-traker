// Worker de procesamiento de lotes BL maritimos (Supabase Edge Function, Deno).
//
// Responsabilidad: consultar Aduanas Chile de forma SECUENCIAL y con pausas,
// parsear el HTML y escribir resultados/errores/logs con service_role.
//
// NO evade captcha, 403, geolocalizacion, autenticacion ni reglas de acceso.
// Lee CON_ConsultaGralMFTOpageCode dinamicamente y mantiene cookies de sesion solo aqui.
//
// !! PENDIENTE DE VALIDACION CONTRA EL SITIO REAL: la URL del formulario inicial,
//    el set exacto de campos y el comportamiento de cookies/pageCode deben verificarse
//    desde la red de produccion (ver docs/CONEXIONES-PENDIENTES.md y docs/Pendientes-infraestructura.md).
//
// Invocacion: POST { "loteId": "<uuid>" }. Limita el trabajo por invocacion con MAX_ITEMS_POR_INVOCACION
// para no exceder el tiempo de una Edge Function; el resto se procesa en una invocacion posterior.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { collectCookies, extractPageCode, parseAduanasMaritimeHtml } from "../_shared/aduanas-parser.ts";

const POST_URL = "https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp?Action=Event";
const FORM_URL = Deno.env.get("ADUANAS_FORM_URL") ?? "https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp";
const PAUSE_MS = Number(Deno.env.get("PROCESSING_PAUSE_MS") ?? "1500");
const TIMEOUT_MS = Number(Deno.env.get("ADUANAS_TIMEOUT_MS") ?? "20000");
const MAX_ITEMS_POR_INVOCACION = Number(Deno.env.get("MAX_ITEMS_POR_INVOCACION") ?? "100");
const PROCESABLES = ["validado", "pendiente", "error_temporal", "sin_resultado"];

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Faltan credenciales service_role de Supabase." }, 500);

  let loteId: string | undefined;
  try { loteId = (await request.json())?.loteId; } catch { /* body invalido */ }
  if (!loteId) return json({ error: "loteId es requerido." }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: items, error: itemsError } = await supabase
    .from("items_consulta")
    .select("id, lote_id, identificador_normalizado, estado, intento_actual, max_intentos")
    .eq("lote_id", loteId)
    .in("estado", PROCESABLES)
    .order("posicion_archivo", { ascending: true })
    .limit(MAX_ITEMS_POR_INVOCACION);
  if (itemsError) return json({ error: `No se pudieron leer los items: ${itemsError.message}` }, 500);
  if (!items?.length) {
    await recalcLote(supabase, loteId, true);
    return json({ ok: true, message: "No hay items pendientes en el lote.", procesados: 0 });
  }

  await supabase.from("lotes_consulta").update({ estado: "procesando", started_at: nowIso() }).eq("id", loteId);

  let exitosos = 0, sinResultado = 0, fallidos = 0;
  for (const item of items) {
    await supabase.from("items_consulta").update({ estado: "en_proceso", started_at: nowIso(), updated_at: nowIso() }).eq("id", item.id);
    const intento = (item.intento_actual ?? 0) + 1;
    const agotado = intento >= (item.max_intentos ?? 10);

    try {
      const { html, statusHttp } = await consultarAduanas(item.identificador_normalizado);
      const outcome = parseAduanasMaritimeHtml(html, statusHttp);
      await guardarLogHtml(supabase, item, statusHttp, html);

      if (outcome.status === "success" && outcome.result) {
        await guardarResultado(supabase, item, outcome.result);
        await supabase.from("items_consulta").update({ estado: "exitoso", intento_actual: intento, ultimo_error: null, ultimo_status_http: statusHttp, updated_at: nowIso(), finished_at: nowIso() }).eq("id", item.id);
        exitosos += 1;
      } else if (outcome.status === "no_result") {
        await supabase.from("items_consulta").update({ estado: "sin_resultado", intento_actual: intento, ultimo_error: outcome.message ?? "Sin resultados.", ultimo_status_http: statusHttp, updated_at: nowIso(), finished_at: nowIso() }).eq("id", item.id);
        sinResultado += 1;
      } else {
        // forbidden / parser_error -> reintentable salvo que se agoten los intentos.
        const estado = agotado ? "agotado_por_reintentos" : "error_temporal";
        await guardarError(supabase, item, outcome.status === "forbidden" ? "forbidden" : "parser_error", outcome.message ?? "Respuesta no procesable.", statusHttp, intento, !agotado);
        await supabase.from("items_consulta").update({ estado, intento_actual: intento, ultimo_error: outcome.message ?? "Respuesta no procesable.", ultimo_status_http: statusHttp, updated_at: nowIso(), finished_at: nowIso() }).eq("id", item.id);
        fallidos += 1;
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error de red al consultar Aduanas.";
      const estado = agotado ? "agotado_por_reintentos" : "error_temporal";
      await guardarError(supabase, item, "network", mensaje, undefined, intento, !agotado);
      await supabase.from("items_consulta").update({ estado, intento_actual: intento, ultimo_error: mensaje, updated_at: nowIso(), finished_at: nowIso() }).eq("id", item.id);
      fallidos += 1;
    }

    await sleep(PAUSE_MS);
  }

  const lote = await recalcLote(supabase, loteId, true);
  return json({
    ok: true,
    message: `Procesados ${items.length} items (${exitosos} exitosos, ${sinResultado} sin resultado, ${fallidos} con error).`,
    procesados: items.length,
    estadoLote: lote
  });
});

/** GET del formulario para leer pageCode + cookies, luego POST con el BL. */
async function consultarAduanas(bl: string): Promise<{ html: string; statusHttp: number }> {
  const formResponse = await fetchConTimeout(FORM_URL, { method: "GET" });
  const formHtml = await formResponse.text();
  const pageCode = extractPageCode(formHtml) ?? "";
  const cookies = collectCookies(formResponse.headers);

  const body = new URLSearchParams({
    EdNroManifiesto: "",
    EdNroGuia: bl,
    CON_ConsultaGralMFTOpageCode: pageCode,
    EventSource: "btnBuscar",
    EventName: "onclick",
    totalManifiestos: "0"
  });

  const response = await fetchConTimeout(POST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookies ? { cookie: cookies } : {})
    },
    body: body.toString()
  });
  return { html: await response.text(), statusHttp: response.status };
}

async function guardarResultado(supabase: SupabaseClient, item: { id: string; identificador_normalizado: string }, result: Record<string, unknown>): Promise<void> {
  const { data: fuente } = await supabase.from("fuentes_consulta").select("id").eq("tipo_consulta", "BL_MARITIMO").limit(1).maybeSingle();
  const payload = {
    tipo_consulta: "BL_MARITIMO",
    identificador_normalizado: item.identificador_normalizado,
    nro_bl: str(result.nroBl) ?? item.identificador_normalizado,
    nro_manifesto: str(result.nroManifesto),
    nave: str(result.nave),
    sentido: str(result.sentido),
    fecha_arribo_zarpe_estimado: str(result.fechaArriboZarpeEstimado),
    cia_naviera: str(result.ciaNaviera),
    fecha_emision_manifiesto: str(result.fechaEmisionManifiesto),
    emisor: str(result.emisor),
    fecha_emision_bl: str(result.fechaEmisionBl),
    fecha_aceptacion: str(result.fechaAceptacion),
    fecha_embarque: str(result.fechaEmbarque),
    almacen: str(result.almacen),
    puerto_embarque: str(result.puertoEmbarque),
    puerto_desembarque: str(result.puertoDesembarque),
    ultimo_transbordo: str(result.ultimoTransbordo),
    total_peso: typeof result.totalPeso === "number" ? result.totalPeso : null,
    fuente_id: fuente?.id ?? null,
    ultimo_item_id: item.id,
    campos_extraidos_json: (result.rawFields as Record<string, unknown>) ?? {},
    consulted_at: nowIso(),
    updated_at: nowIso()
  };
  // Resultado vigente: reemplaza el anterior por (tipo_consulta, identificador_normalizado).
  const { data: upserted } = await supabase
    .from("resultados_aduana")
    .upsert(payload, { onConflict: "tipo_consulta,identificador_normalizado" })
    .select("id")
    .maybeSingle();
  if (upserted?.id) await supabase.from("items_consulta").update({ resultado_id: upserted.id }).eq("id", item.id);
}

async function guardarError(supabase: SupabaseClient, item: { id: string; lote_id: string }, tipoError: string, mensaje: string, statusHttp: number | undefined, intento: number, reintentable: boolean): Promise<void> {
  await supabase.from("errores_consulta").insert({
    item_id: item.id,
    lote_id: item.lote_id,
    tipo_error: tipoError,
    mensaje_usuario: mensaje,
    detalle_tecnico: statusHttp ? `HTTP ${statusHttp}. Registrado sin intentar evadir restricciones externas.` : null,
    status_http: statusHttp ?? null,
    intento,
    reintentable
  });
}

async function guardarLogHtml(supabase: SupabaseClient, item: { id: string; lote_id: string }, statusHttp: number, html: string): Promise<void> {
  await supabase.from("logs_html_consulta").insert({
    item_id: item.id,
    lote_id: item.lote_id,
    status_http: statusHttp,
    url_final: POST_URL,
    metodo: "POST",
    html_respuesta: html.slice(0, 200_000),
    visible_solo_admin: true
  });
}

/** Recalcula totales del lote y fija estado final. */
async function recalcLote(supabase: SupabaseClient, loteId: string, finalizar: boolean): Promise<string> {
  const { data: all } = await supabase.from("items_consulta").select("estado").eq("lote_id", loteId);
  const items = all ?? [];
  const total = items.length;
  const exitosos = items.filter((i) => i.estado === "exitoso").length;
  const sinResultado = items.filter((i) => i.estado === "sin_resultado").length;
  const fallidos = items.filter((i) => ["error_temporal", "error_permanente", "agotado_por_reintentos"].includes(i.estado)).length;
  const pendientes = items.filter((i) => PROCESABLES.includes(i.estado) || i.estado === "en_proceso").length;
  const estado = !finalizar || pendientes > 0 ? "procesando" : (fallidos || sinResultado ? "completado_con_errores" : "completado");
  await supabase.from("lotes_consulta").update({
    total_items: total,
    total_exitosos: exitosos,
    total_sin_resultado: sinResultado,
    total_fallidos: fallidos,
    estado,
    finished_at: estado.startsWith("completado") ? nowIso() : null
  }).eq("id", loteId);
  return estado;
}

async function fetchConTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function nowIso(): string { return new Date().toISOString(); }
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
