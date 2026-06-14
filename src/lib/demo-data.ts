import type { BlBatch, BlItem, SourceHealth } from "./types";

const DEMO_TIME = "2026-06-11T19:37:00.000Z";

export const sourceHealth: SourceHealth[] = [
  { id: "aduanas", nombre: "Aduanas Chile - BL Maritimo", estado: "activa", ultimoIntento: DEMO_TIME, ultimoExito: DEMO_TIME, mensaje: "POST confirmado. Page code dinamico pendiente en worker real." },
  { id: "logs", nombre: "Logs HTML temporales", estado: "activa", ultimoIntento: DEMO_TIME, ultimoExito: DEMO_TIME, mensaje: "Retencion tecnica definida: 1 dia." }
];

// Worker secuencial: OCULTO de la vista a peticion del negocio (2026-06-12).
// Se mantiene documentado aqui para reactivarlo cuando exista el backend real.
// Es la pieza que realmente consultaria Aduanas (ver docs/ANALISIS-PRE-DESPLIEGUE.md §3.1).
// Para volver a mostrarlo, agrega `...hiddenSources` al array sourceHealth de arriba.
export const hiddenSources: SourceHealth[] = [
  { id: "worker", nombre: "Worker secuencial", estado: "en_revision", ultimoIntento: DEMO_TIME, mensaje: "Pendiente red final, pausa segura y presupuesto Railway." }
];

export const demoUsers = [
  { id: "admin", email: "admin@kposervices.cl", nombre: "Admin KPO", rol: "admin", activo: true },
  { id: "ops", email: "operaciones@kposervices.cl", nombre: "Operaciones", rol: "usuario", activo: true }
] as const;

export const demoBatch: BlBatch = {
  id: "demo-001",
  nombreLote: "Validacion inicial BL maritimos",
  estado: "completado_con_errores",
  totalItems: 5,
  totalExitosos: 3,
  totalSinResultado: 1,
  totalFallidos: 1,
  totalReintentos: 2,
  createdAt: "2026-06-11T19:30:00.000Z",
  finishedAt: DEMO_TIME,
  items: [
    successItem("MEDUWU951960", "271842", "MSC TIANPING", "San Antonio", "Ningbo", 18274.3),
    successItem("MAEU269371924", "271918", "MAERSK LIMA", "San Antonio", "Shanghai", 10440),
    errorItem("NGMZ61113300", "sin_resultado", "No se detectaron resultados visibles para este BL."),
    errorItem("MAEU269768230", "error_temporal", "Aduanas rechazo la solicitud con 403 Forbidden.", 403, 2),
    successItem("MAEU269848221", "271944", "CAP SAN VINCENT", "Valparaiso", "Qingdao", 9360.5)
  ]
};

function baseItem(bl: string): BlItem {
  return { id: crypto.randomUUID(), loteId: "demo-001", posicionArchivo: 1, identificadorOriginal: bl, identificadorNormalizado: bl, estado: "validado", intentoActual: 0, maxIntentos: 10, updatedAt: DEMO_TIME };
}

function successItem(bl: string, manifesto: string, nave: string, puertoDesembarque: string, puertoEmbarque: string, totalPeso: number): BlItem {
  return {
    ...baseItem(bl),
    estado: "exitoso",
    intentoActual: 1,
    resultado: {
      nroBl: bl,
      nroManifesto: manifesto,
      nave,
      sentido: "INGRESO",
      fechaArriboZarpeEstimado: "21/06/2026 23:00",
      ciaNaviera: nave.includes("MSC") ? "MSC CHILE S.A." : "MAERSK CHILE S.A.",
      fechaEmisionManifiesto: "27-05-2026",
      almacen: puertoDesembarque === "San Antonio" ? "SAN ANTONIO TERMINAL INTERNACIONAL S.A." : "TPS VALPARAISO",
      puertoEmbarque,
      puertoDesembarque,
      totalPeso,
      fuente: "Aduanas Chile",
      consultedAt: DEMO_TIME
    }
  };
}

function errorItem(bl: string, estado: BlItem["estado"], message: string, statusHttp?: number, attempts = 1): BlItem {
  return { ...baseItem(bl), estado, intentoActual: attempts, ultimoError: message, ultimoStatusHttp: statusHttp };
}
