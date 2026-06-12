import type { BatchStatus, ItemStatus } from "./types";

export const itemStatusLabels: Record<ItemStatus, string> = {
  validado: "Validado",
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  exitoso: "Exitoso",
  sin_resultado: "Sin resultado",
  error_temporal: "Error temporal",
  error_permanente: "Error permanente",
  agotado_por_reintentos: "Agotado",
  cancelado: "Cancelado"
};

export const batchStatusLabels: Record<BatchStatus, string> = {
  validado: "Validado",
  en_cola: "En cola",
  procesando: "Procesando",
  completado: "Completado",
  completado_con_errores: "Completado con errores",
  cancelado: "Cancelado",
  fallido: "Fallido"
};

export function statusLabel(status: ItemStatus | BatchStatus): string {
  return itemStatusLabels[status as ItemStatus] ?? batchStatusLabels[status as BatchStatus] ?? status;
}

export function badgeClass(status: ItemStatus | BatchStatus): string {
  if (["exitoso", "completado"].includes(status)) return "badge success";
  if (["sin_resultado", "error_temporal", "agotado_por_reintentos", "completado_con_errores"].includes(status)) return "badge warning";
  if (["error_permanente", "fallido", "cancelado"].includes(status)) return "badge danger";
  if (["en_proceso", "procesando", "en_cola"].includes(status)) return "badge info";
  return "badge muted";
}
