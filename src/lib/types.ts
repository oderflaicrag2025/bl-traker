export type UserRole = "admin" | "usuario";

export type ItemStatus =
  | "validado"
  | "pendiente"
  | "en_proceso"
  | "exitoso"
  | "sin_resultado"
  | "error_temporal"
  | "error_permanente"
  | "agotado_por_reintentos"
  | "cancelado";

export type BatchStatus =
  | "validado"
  | "en_cola"
  | "procesando"
  | "completado"
  | "completado_con_errores"
  | "cancelado"
  | "fallido";

export type SourceStatus = "activa" | "en_revision" | "inactiva";

export interface AduanaResult {
  nroBl: string;
  nroManifesto?: string;
  nave?: string;
  sentido?: string;
  fechaArriboZarpeEstimado?: string;
  ciaNaviera?: string;
  fechaEmisionManifiesto?: string;
  emisor?: string;
  fechaEmisionBl?: string;
  fechaAceptacion?: string;
  fechaEmbarque?: string;
  almacen?: string;
  puertoEmbarque?: string;
  puertoDesembarque?: string;
  ultimoTransbordo?: string;
  totalPeso?: number;
  fuente: string;
  consultedAt: string;
  camposExtraidosJson?: Record<string, unknown>;
}

export interface ConsultationError {
  tipoError: string;
  mensajeUsuario: string;
  detalleTecnico?: string;
  statusHttp?: number;
  intento: number;
  reintentable: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface BlItem {
  id: string;
  loteId: string;
  posicionArchivo: number;
  identificadorOriginal: string;
  identificadorNormalizado: string;
  estado: ItemStatus;
  intentoActual: number;
  maxIntentos: number;
  ultimoError?: string;
  ultimoStatusHttp?: number;
  resultado?: AduanaResult;
  error?: ConsultationError;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface BlBatch {
  id: string;
  nombreLote: string;
  estado: BatchStatus;
  totalItems: number;
  totalExitosos: number;
  totalSinResultado: number;
  totalFallidos: number;
  totalReintentos: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  cancelRequestedAt?: string;
  sourceFileName?: string;
  items: BlItem[];
}

export interface SourceHealth {
  id: string;
  nombre: string;
  estado: SourceStatus;
  ultimoIntento?: string;
  ultimoExito?: string;
  mensaje: string;
}

export interface DashboardFilters {
  search: string;
  estado: "all" | ItemStatus;
  puerto: "all" | string;
  dateFrom: string;
  dateTo: string;
}

export interface UploadPreviewRow {
  original: string;
  normalized: string;
  position: number;
  valid: boolean;
  duplicated: boolean;
  reason?: string;
}

export interface UploadPreview {
  rows: UploadPreviewRow[];
  validRows: UploadPreviewRow[];
  invalidRows: UploadPreviewRow[];
  duplicateRows: UploadPreviewRow[];
  truncated: boolean;
  fileName?: string;
}
