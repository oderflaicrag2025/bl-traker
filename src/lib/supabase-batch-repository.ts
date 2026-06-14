import { getSupabaseClient } from "./supabase-client";
import type { BatchRepository } from "./batch-repository";
import type { AduanaResult, BatchStatus, BlBatch, BlItem, ConsultationError, ItemStatus } from "./types";

// Repositorio de lotes respaldado por Supabase. Implementa la MISMA interfaz que
// LocalBatchRepository, asi la UI no cambia. El cliente (clave anon) puede:
//  - leer lotes/items/resultados/errores (RLS de solo lectura),
//  - crear lotes + items y actualizar estado del lote (cancelar) y de items (reintento).
// La escritura de resultados/errores/logs la hace el WORKER con service_role.
// Ver docs/CONEXIONES-PENDIENTES.md.

const LOTE_SELECT = `
  id, nombre_lote, estado, total_items, total_exitosos, total_sin_resultado, total_fallidos,
  total_reintentos, created_at, started_at, finished_at, cancel_requested_at, archivo_nombre,
  items:items_consulta(
    id, lote_id, posicion_archivo, identificador_original, identificador_normalizado, estado,
    intento_actual, max_intentos, ultimo_error, ultimo_status_http, updated_at, started_at, finished_at,
    resultado:resultados_aduana(*),
    errores:errores_consulta(*)
  )
`;

export class SupabaseBatchRepository implements BatchRepository {
  async list(): Promise<BlBatch[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("lotes_consulta")
      .select(LOTE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`No se pudieron cargar los lotes: ${error.message}`);
    return (data ?? []).map(mapLoteRow);
  }

  /**
   * Persiste lotes e items del lado del cliente (estado/totales/intentos).
   * NO escribe resultados ni errores: eso es responsabilidad del worker (service_role).
   */
  async saveAll(batches: BlBatch[]): Promise<void> {
    if (!batches.length) return;
    const supabase = getSupabaseClient();

    // No enviamos creado_por: un trigger BEFORE INSERT lo fija a auth.uid() en la creacion,
    // asi un admin que edite un lote ajeno no se vuelve dueno por accidente (002_*.sql).
    const loteRows = batches.map((batch) => ({
      id: batch.id,
      nombre_lote: batch.nombreLote,
      estado: batch.estado,
      total_items: batch.totalItems,
      total_exitosos: batch.totalExitosos,
      total_sin_resultado: batch.totalSinResultado,
      total_fallidos: batch.totalFallidos,
      total_reintentos: batch.totalReintentos,
      archivo_nombre: batch.sourceFileName ?? null,
      created_at: batch.createdAt,
      started_at: batch.startedAt ?? null,
      finished_at: batch.finishedAt ?? null,
      cancel_requested_at: batch.cancelRequestedAt ?? null
    }));
    const loteResult = await supabase.from("lotes_consulta").upsert(loteRows, { onConflict: "id" });
    if (loteResult.error) throw new Error(`No se pudo guardar el lote: ${loteResult.error.message}`);

    const itemRows = batches.flatMap((batch) =>
      batch.items.map((item) => ({
        id: item.id,
        lote_id: item.loteId,
        posicion_archivo: item.posicionArchivo,
        identificador_original: item.identificadorOriginal,
        identificador_normalizado: item.identificadorNormalizado,
        estado: item.estado,
        intento_actual: item.intentoActual,
        max_intentos: item.maxIntentos,
        ultimo_error: item.ultimoError ?? null,
        ultimo_status_http: item.ultimoStatusHttp ?? null,
        updated_at: item.updatedAt,
        started_at: item.startedAt ?? null,
        finished_at: item.finishedAt ?? null
      }))
    );
    if (itemRows.length) {
      const itemResult = await supabase.from("items_consulta").upsert(itemRows, { onConflict: "id" });
      if (itemResult.error) throw new Error(`No se pudieron guardar los items: ${itemResult.error.message}`);
    }
  }

  /** En modo Supabase no se "resetea" destructivamente: simplemente recarga desde la base. */
  async reset(): Promise<BlBatch[]> {
    return this.list();
  }
}

/* ---------- mapeo fila -> dominio ---------- */

interface LoteRow {
  id: string;
  nombre_lote: string;
  estado: string;
  total_items: number;
  total_exitosos: number;
  total_sin_resultado: number;
  total_fallidos: number;
  total_reintentos: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  cancel_requested_at: string | null;
  archivo_nombre: string | null;
  items: ItemRow[] | null;
}

interface ItemRow {
  id: string;
  lote_id: string;
  posicion_archivo: number;
  identificador_original: string;
  identificador_normalizado: string;
  estado: string;
  intento_actual: number;
  max_intentos: number;
  ultimo_error: string | null;
  ultimo_status_http: number | null;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  resultado: ResultadoRow | ResultadoRow[] | null;
  errores: ErrorRow[] | null;
}

interface ResultadoRow {
  nro_bl: string | null;
  nro_manifesto: string | null;
  nave: string | null;
  sentido: string | null;
  fecha_arribo_zarpe_estimado: string | null;
  cia_naviera: string | null;
  fecha_emision_manifiesto: string | null;
  emisor: string | null;
  fecha_emision_bl: string | null;
  fecha_aceptacion: string | null;
  fecha_embarque: string | null;
  almacen: string | null;
  puerto_embarque: string | null;
  puerto_desembarque: string | null;
  ultimo_transbordo: string | null;
  total_peso: number | null;
  campos_extraidos_json: Record<string, unknown> | null;
  consulted_at: string;
}

interface ErrorRow {
  tipo_error: string;
  mensaje_usuario: string;
  detalle_tecnico: string | null;
  status_http: number | null;
  intento: number;
  reintentable: boolean;
  created_at: string;
  expires_at: string;
}

function mapLoteRow(row: LoteRow): BlBatch {
  const items = (row.items ?? [])
    .map(mapItemRow)
    .sort((a, b) => a.posicionArchivo - b.posicionArchivo);
  return {
    id: row.id,
    nombreLote: row.nombre_lote,
    estado: row.estado as BatchStatus,
    totalItems: row.total_items,
    totalExitosos: row.total_exitosos,
    totalSinResultado: row.total_sin_resultado,
    totalFallidos: row.total_fallidos,
    totalReintentos: row.total_reintentos,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    cancelRequestedAt: row.cancel_requested_at ?? undefined,
    sourceFileName: row.archivo_nombre ?? undefined,
    items
  };
}

function mapItemRow(row: ItemRow): BlItem {
  const resultadoRow = Array.isArray(row.resultado) ? row.resultado[0] : row.resultado;
  const errores = row.errores ?? [];
  const ultimoError = errores.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    id: row.id,
    loteId: row.lote_id,
    posicionArchivo: row.posicion_archivo,
    identificadorOriginal: row.identificador_original,
    identificadorNormalizado: row.identificador_normalizado,
    estado: row.estado as ItemStatus,
    intentoActual: row.intento_actual,
    maxIntentos: row.max_intentos,
    ultimoError: row.ultimo_error ?? undefined,
    ultimoStatusHttp: row.ultimo_status_http ?? undefined,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    resultado: resultadoRow ? mapResultado(resultadoRow) : undefined,
    error: ultimoError ? mapError(ultimoError) : undefined
  };
}

function mapResultado(row: ResultadoRow): AduanaResult {
  return {
    nroBl: row.nro_bl ?? "",
    nroManifesto: row.nro_manifesto ?? undefined,
    nave: row.nave ?? undefined,
    sentido: row.sentido ?? undefined,
    fechaArriboZarpeEstimado: row.fecha_arribo_zarpe_estimado ?? undefined,
    ciaNaviera: row.cia_naviera ?? undefined,
    fechaEmisionManifiesto: row.fecha_emision_manifiesto ?? undefined,
    emisor: row.emisor ?? undefined,
    fechaEmisionBl: row.fecha_emision_bl ?? undefined,
    fechaAceptacion: row.fecha_aceptacion ?? undefined,
    fechaEmbarque: row.fecha_embarque ?? undefined,
    almacen: row.almacen ?? undefined,
    puertoEmbarque: row.puerto_embarque ?? undefined,
    puertoDesembarque: row.puerto_desembarque ?? undefined,
    ultimoTransbordo: row.ultimo_transbordo ?? undefined,
    totalPeso: row.total_peso ?? undefined,
    fuente: "Aduanas Chile",
    consultedAt: row.consulted_at,
    camposExtraidosJson: row.campos_extraidos_json ?? undefined
  };
}

function mapError(row: ErrorRow): ConsultationError {
  return {
    tipoError: row.tipo_error,
    mensajeUsuario: row.mensaje_usuario,
    detalleTecnico: row.detalle_tecnico ?? undefined,
    statusHttp: row.status_http ?? undefined,
    intento: row.intento,
    reintentable: row.reintentable,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}
