import type { BlBatch, BlItem, ConsultationError, DashboardFilters } from "./types";
import { addDaysIso } from "./format";

export function createBatchFromRows(nombreLote: string, rows: Array<{ original: string; normalized: string; position: number }>, sourceFileName?: string): BlBatch {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return withBatchTotals({
    id,
    nombreLote: nombreLote.trim() || "Lote BL",
    estado: "validado",
    totalItems: rows.length,
    totalExitosos: 0,
    totalSinResultado: 0,
    totalFallidos: 0,
    totalReintentos: 0,
    createdAt: now,
    sourceFileName,
    items: rows.map((row) => ({
      id: crypto.randomUUID(),
      loteId: id,
      posicionArchivo: row.position,
      identificadorOriginal: row.original,
      identificadorNormalizado: row.normalized,
      estado: "validado",
      intentoActual: 0,
      maxIntentos: 10,
      updatedAt: now
    }))
  });
}

export function withBatchTotals(batch: BlBatch): BlBatch {
  const totalExitosos = batch.items.filter((item) => item.estado === "exitoso").length;
  const totalSinResultado = batch.items.filter((item) => item.estado === "sin_resultado").length;
  const totalFallidos = batch.items.filter((item) => ["error_temporal", "error_permanente", "agotado_por_reintentos"].includes(item.estado)).length;
  return { ...batch, totalItems: batch.items.length, totalExitosos, totalSinResultado, totalFallidos, totalReintentos: batch.items.reduce((sum, item) => sum + Math.max(0, item.intentoActual - 1), 0) };
}

export function filterItems(items: BlItem[], filters: DashboardFilters): BlItem[] {
  const search = filters.search.trim().toUpperCase();
  const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  return items.filter((item) => {
    const result = item.resultado;
    const text = [item.identificadorNormalizado, result?.nroManifesto, result?.nave, result?.puertoEmbarque, result?.puertoDesembarque, result?.ciaNaviera, item.ultimoError].filter(Boolean).join(" ").toUpperCase();
    const port = [result?.puertoEmbarque, result?.puertoDesembarque].filter(Boolean).join(" ").toLowerCase();
    const itemTime = new Date(result?.consultedAt ?? item.updatedAt).getTime();
    return (!search || text.includes(search)) && (filters.estado === "all" || item.estado === filters.estado) && (filters.puerto === "all" || port.includes(filters.puerto.toLowerCase())) && (!from || itemTime >= from) && (!to || itemTime <= to);
  });
}

export function resetItemForRetry(batch: BlBatch, itemId: string): BlBatch {
  return withBatchTotals({
    ...batch,
    estado: "validado",
    finishedAt: undefined,
    items: batch.items.map((item) => item.id === itemId ? { ...item, estado: item.intentoActual >= item.maxIntentos ? "agotado_por_reintentos" : "validado", ultimoError: item.intentoActual >= item.maxIntentos ? "El item ya alcanzo el maximo de 10 intentos." : undefined, ultimoStatusHttp: item.intentoActual >= item.maxIntentos ? item.ultimoStatusHttp : undefined, resultado: undefined, error: undefined, updatedAt: new Date().toISOString() } : item)
  });
}

export function cancelBatch(batch: BlBatch): BlBatch {
  const now = new Date().toISOString();
  return withBatchTotals({
    ...batch,
    estado: "cancelado",
    cancelRequestedAt: now,
    finishedAt: now,
    items: batch.items.map((item) => item.estado === "en_proceso" || item.estado === "validado" || item.estado === "pendiente" ? { ...item, estado: "cancelado", updatedAt: now, finishedAt: now } : item)
  });
}

export function resolveDemoItem(item: BlItem): BlItem {
  const now = new Date().toISOString();
  const nextAttempt = item.intentoActual + 1;
  if (nextAttempt > item.maxIntentos) {
    return { ...item, estado: "agotado_por_reintentos", ultimoError: "El item alcanzo el maximo de 10 intentos.", updatedAt: now, finishedAt: now };
  }
  if (item.identificadorNormalizado.endsWith("230")) {
    const exhausted = nextAttempt >= item.maxIntentos;
    return withError(item, exhausted ? "agotado_por_reintentos" : "error_temporal", "forbidden", "Aduanas rechazo la solicitud con 403 Forbidden.", 403, nextAttempt, exhausted);
  }
  if (item.identificadorNormalizado.endsWith("300")) {
    return withError(item, "sin_resultado", "no_result", "No se detectaron resultados visibles para este BL.", undefined, nextAttempt, false);
  }
  return {
    ...item,
    estado: "exitoso",
    intentoActual: nextAttempt,
    ultimoError: undefined,
    ultimoStatusHttp: undefined,
    updatedAt: now,
    finishedAt: now,
    resultado: {
      nroBl: item.identificadorNormalizado,
      nroManifesto: item.identificadorNormalizado.includes("MED") ? "271842" : "271918",
      nave: item.identificadorNormalizado.includes("MED") ? "MSC TIANPING" : "MAERSK LIMA",
      sentido: "INGRESO",
      fechaArriboZarpeEstimado: "21/06/2026 23:00",
      ciaNaviera: item.identificadorNormalizado.includes("MED") ? "MSC CHILE S.A." : "MAERSK CHILE S.A.",
      fechaEmisionManifiesto: "27-05-2026",
      almacen: "SAN ANTONIO TERMINAL INTERNACIONAL S.A.",
      puertoEmbarque: "Ningbo",
      puertoDesembarque: "San Antonio",
      totalPeso: item.identificadorNormalizado.includes("MED") ? 18274.3 : 10440,
      fuente: "Aduanas Chile",
      consultedAt: now
    }
  };
}

function withError(item: BlItem, estado: BlItem["estado"], tipoError: string, message: string, statusHttp: number | undefined, intento: number, exhausted: boolean): BlItem {
  const now = new Date().toISOString();
  const error: ConsultationError = { tipoError, mensajeUsuario: exhausted ? "Se alcanzo el maximo de intentos para este BL." : message, detalleTecnico: statusHttp ? `HTTP ${statusHttp}. Registrado sin intentar evadir restricciones externas.` : undefined, statusHttp, intento, reintentable: !exhausted, createdAt: now, expiresAt: addDaysIso(now, 1) };
  return { ...item, estado, intentoActual: intento, ultimoError: error.mensajeUsuario, ultimoStatusHttp: statusHttp, error, resultado: undefined, updatedAt: now, finishedAt: now };
}
