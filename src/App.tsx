import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, LogOut, Play, Plus, RefreshCw, RotateCcw, Search, Ship, X } from "lucide-react";
import ExcelJS from "exceljs";
import { z } from "zod";

type ItemStatus = "validado" | "pendiente" | "en_proceso" | "exitoso" | "sin_resultado" | "error_temporal" | "agotado_por_reintentos";
type BatchStatus = "validado" | "procesando" | "completado" | "completado_con_errores";

type Result = {
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
};

type Item = {
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
  resultado?: Result;
  updatedAt: string;
};

type Batch = {
  id: string;
  nombreLote: string;
  estado: BatchStatus;
  totalItems: number;
  totalExitosos: number;
  totalSinResultado: number;
  totalFallidos: number;
  totalReintentos: number;
  createdAt: string;
  finishedAt?: string;
  items: Item[];
};

type Filters = { search: string; estado: "all" | ItemStatus; puerto: string };

const MAX_BATCH_SIZE = 100;
const blSchema = z.string().trim().min(4).max(30).regex(/^[A-Z0-9-]+$/i);

const demoBatch: Batch = {
  id: "demo-001",
  nombreLote: "Validacion inicial BL maritimos",
  estado: "completado_con_errores",
  totalItems: 5,
  totalExitosos: 3,
  totalSinResultado: 1,
  totalFallidos: 1,
  totalReintentos: 2,
  createdAt: "2026-06-11T19:30:00.000Z",
  finishedAt: "2026-06-11T19:37:00.000Z",
  items: [
    successItem("MEDUWU951960", "271842", "MSC TIANPING", "San Antonio", "Ningbo", 18274.3),
    successItem("MAEU269371924", "271918", "MAERSK LIMA", "San Antonio", "Shanghai", 10440),
    errorItem("NGMZ61113300", "sin_resultado", "No se detectaron resultados visibles para este BL."),
    errorItem("MAEU269768230", "error_temporal", "Aduanas rechazo la solicitud con 403 Forbidden.", 403),
    successItem("MAEU269848221", "271944", "CAP SAN VINCENT", "Valparaiso", "Qingdao", 9360.5)
  ]
};

function successItem(bl: string, manifesto: string, nave: string, puertoDesembarque: string, puertoEmbarque: string, totalPeso: number): Item {
  return {
    id: crypto.randomUUID(), loteId: "demo-001", posicionArchivo: 1, identificadorOriginal: bl, identificadorNormalizado: bl,
    estado: "exitoso", intentoActual: 1, maxIntentos: 10, updatedAt: "2026-06-11T19:37:00.000Z",
    resultado: { nroBl: bl, nroManifesto: manifesto, nave, sentido: "INGRESO", fechaArriboZarpeEstimado: "21/06/2026 23:00", ciaNaviera: nave.includes("MSC") ? "MSC CHILE S.A." : "MAERSK CHILE S.A.", fechaEmisionManifiesto: "27-05-2026", almacen: puertoDesembarque === "San Antonio" ? "SAN ANTONIO TERMINAL INTERNACIONAL S.A." : "TPS VALPARAISO", puertoEmbarque, puertoDesembarque, totalPeso, fuente: "Aduanas Chile", consultedAt: "2026-06-11T19:37:00.000Z" }
  };
}

function errorItem(bl: string, estado: ItemStatus, error: string, statusHttp?: number): Item {
  return { id: crypto.randomUUID(), loteId: "demo-001", posicionArchivo: 1, identificadorOriginal: bl, identificadorNormalizado: bl, estado, intentoActual: statusHttp ? 2 : 1, maxIntentos: 10, ultimoError: error, ultimoStatusHttp: statusHttp, updatedAt: "2026-06-11T19:37:00.000Z" };
}

function normalizeBl(value: string) { return value.trim().replace(/\s+/g, "").toUpperCase(); }
function fmtDate(value?: string) { return value ? new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value)) : "-"; }
function statusLabel(status: ItemStatus | BatchStatus) { return ({ validado: "Validado", pendiente: "Pendiente", en_proceso: "En proceso", exitoso: "Exitoso", sin_resultado: "Sin resultado", error_temporal: "Error temporal", agotado_por_reintentos: "Agotado", procesando: "Procesando", completado: "Completado", completado_con_errores: "Completado con errores" } as Record<string, string>)[status] ?? status; }
function badgeClass(status: ItemStatus | BatchStatus) { if (["exitoso", "completado"].includes(status)) return "badge success"; if (["sin_resultado", "error_temporal", "agotado_por_reintentos", "completado_con_errores"].includes(status)) return "badge warning"; if (["en_proceso", "procesando"].includes(status)) return "badge info"; return "badge muted"; }

export function App() {
  const [logged, setLogged] = useState(import.meta.env.VITE_AUTH_MODE !== "supabase");
  const [batches, setBatches] = useState<Batch[]>([demoBatch]);
  const [raw, setRaw] = useState("MAEU269371924\nMAEU269768230\nMEDUWU951960");
  const [batchName, setBatchName] = useState("Lote BL demo");
  const [filters, setFilters] = useState<Filters>({ search: "", estado: "all", puerto: "all" });
  const [selected, setSelected] = useState<Item | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allItems = useMemo(() => batches.flatMap((batch) => batch.items.map((item) => ({ ...item, loteId: batch.id }))), [batches]);
  const filtered = useMemo(() => allItems.filter((item) => {
    const text = [item.identificadorNormalizado, item.resultado?.nroManifesto, item.resultado?.nave, item.resultado?.puertoEmbarque, item.resultado?.puertoDesembarque, item.ultimoError].filter(Boolean).join(" ").toUpperCase();
    const port = [item.resultado?.puertoEmbarque, item.resultado?.puertoDesembarque].filter(Boolean).join(" ");
    return (!filters.search || text.includes(filters.search.toUpperCase())) && (filters.estado === "all" || item.estado === filters.estado) && (filters.puerto === "all" || port.toLowerCase().includes(filters.puerto.toLowerCase()));
  }), [allItems, filters]);

  if (!logged) return <Login onLogin={() => setLogged(true)} />;

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(null), 3200); }

  function createBatch() {
    const existing = new Set(allItems.filter((item) => item.estado === "exitoso").map((item) => item.identificadorNormalizado));
    const seen = new Set<string>();
    const valid = raw.split(/[\n,;\t]+/).map((v) => v.trim()).filter(Boolean).slice(0, MAX_BATCH_SIZE).flatMap((original, index) => {
      const normalized = normalizeBl(original);
      if (!blSchema.safeParse(normalized).success || seen.has(normalized) || existing.has(normalized)) return [];
      seen.add(normalized);
      return [{ id: crypto.randomUUID(), loteId: "", posicionArchivo: index + 1, identificadorOriginal: original, identificadorNormalizado: normalized, estado: "validado" as ItemStatus, intentoActual: 0, maxIntentos: 10, updatedAt: new Date().toISOString() }];
    });
    if (!valid.length) return notify("No hay BL validos para crear un lote.");
    const id = crypto.randomUUID();
    const batch: Batch = { id, nombreLote: batchName || "Lote BL", estado: "validado", totalItems: valid.length, totalExitosos: 0, totalSinResultado: 0, totalFallidos: 0, totalReintentos: 0, createdAt: new Date().toISOString(), items: valid.map((item) => ({ ...item, loteId: id })) };
    setBatches((current) => [batch, ...current]);
    notify(`Lote creado con ${valid.length} BL validos.`);
  }

  async function processBatch() {
    const candidate = batches.find((batch) => batch.estado === "validado" || batch.estado === "completado_con_errores");
    if (!candidate) return notify("No hay lote validado para procesar.");
    setProcessing(true);
    let next = { ...candidate, estado: "procesando" as BatchStatus };
    setBatches((current) => current.map((batch) => batch.id === next.id ? next : batch));
    for (const item of next.items) {
      next = { ...next, items: next.items.map((row) => row.id === item.id ? { ...row, estado: "en_proceso", intentoActual: row.intentoActual + 1 } : row) };
      setBatches((current) => current.map((batch) => batch.id === next.id ? next : batch));
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      next = { ...next, items: next.items.map((row) => row.id === item.id ? resolveDemo(row) : row) };
      next = withTotals(next);
      setBatches((current) => current.map((batch) => batch.id === next.id ? next : batch));
    }
    next = withTotals({ ...next, estado: next.totalFallidos || next.totalSinResultado ? "completado_con_errores" : "completado", finishedAt: new Date().toISOString() });
    setBatches((current) => current.map((batch) => batch.id === next.id ? next : batch));
    setProcessing(false);
    notify("Procesamiento finalizado con trazabilidad por item.");
  }

  function retry(item: Item) {
    setBatches((current) => current.map((batch) => batch.id !== item.loteId ? batch : withTotals({ ...batch, estado: "validado", items: batch.items.map((row) => row.id === item.id ? { ...row, estado: "validado", ultimoError: undefined, ultimoStatusHttp: undefined, resultado: undefined } : row) })));
    notify(`BL ${item.identificadorNormalizado} listo para reintento.`);
  }

  async function exportExcel() {
    if (!filtered.length) return notify("No hay filas para exportar.");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Resultados");
    sheet.columns = ["Lote", "Fecha consulta", "Estado item", "Nro BL", "Nro Manifiesto", "Nave", "Sentido", "Fecha Arribo/Zarpe Estimado", "Cia Naviera", "Almacen", "Puerto Embarque", "Puerto Desembarque", "Total Peso", "Fuente", "Intentos", "Error Resumen"].map((header) => ({ header, key: header, width: 22 }));
    filtered.forEach((item) => sheet.addRow({ "Lote": item.loteId, "Fecha consulta": item.resultado?.consultedAt ?? item.updatedAt, "Estado item": item.estado, "Nro BL": item.resultado?.nroBl ?? item.identificadorNormalizado, "Nro Manifiesto": item.resultado?.nroManifesto, "Nave": item.resultado?.nave, "Sentido": item.resultado?.sentido, "Fecha Arribo/Zarpe Estimado": item.resultado?.fechaArriboZarpeEstimado, "Cia Naviera": item.resultado?.ciaNaviera, "Almacen": item.resultado?.almacen, "Puerto Embarque": item.resultado?.puertoEmbarque, "Puerto Desembarque": item.resultado?.puertoDesembarque, "Total Peso": item.resultado?.totalPeso, "Fuente": item.resultado?.fuente ?? "Aduanas Chile", "Intentos": item.intentoActual, "Error Resumen": item.ultimoError }));
    const errors = filtered.filter((item) => item.ultimoError);
    if (errors.length) {
      const errorSheet = workbook.addWorksheet("Errores");
      errorSheet.columns = ["Identificador Original", "Identificador Normalizado", "Estado", "Mensaje Usuario", "Status HTTP", "Intento Actual", "Max Intentos"].map((header) => ({ header, key: header, width: 26 }));
      errors.forEach((item) => errorSheet.addRow({ "Identificador Original": item.identificadorOriginal, "Identificador Normalizado": item.identificadorNormalizado, "Estado": item.estado, "Mensaje Usuario": item.ultimoError, "Status HTTP": item.ultimoStatusHttp, "Intento Actual": item.intentoActual, "Max Intentos": item.maxIntentos }));
    }
    workbook.worksheets.forEach((sheetItem) => { sheetItem.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheetItem.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } }; });
    const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `KPO_BL_Tracker_${new Date().toISOString().slice(0, 10)}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div><header className="app-header"><div className="container header-inner"><div className="brand"><div className="brand-mark"><Ship size={22}/></div><div><h1>KPO BL Tracker</h1><p>{batches[0]?.finishedAt ? `Ultima actualizacion: ${fmtDate(batches[0].finishedAt)}` : "Sistema interno de consulta BL"}</p></div></div><div className="header-actions"><button className="btn btn-ghost" onClick={() => notify("Datos recargados")}> <RefreshCw size={16}/> Recargar</button><button className="btn btn-ghost" disabled={processing} onClick={() => void processBatch()}><Play size={16}/>{processing ? "Procesando..." : "Procesar lote"}</button><button className="btn btn-white" disabled={!filtered.length} onClick={() => void exportExcel()}><Download size={16}/>Exportar Excel</button><span className="badge info">admin</span><button className="btn btn-ghost" onClick={() => setLogged(false)}><LogOut size={16}/>Salir</button></div></div></header><main className="container main grid"><div className="alert"><AlertTriangle size={17}/><div><strong>Modo demo listo para Supabase</strong><div>Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para conectar autenticacion y datos reales.</div></div></div><SourceStrip/><Summary items={allItems}/><section className="panel"><div className="panel-header"><div><p className="panel-title">Carga de BL maritimos</p><p className="panel-subtitle">Pegado manual o CSV/TXT. Limite inicial: {MAX_BATCH_SIZE} registros por lote.</p></div><button className="btn btn-primary" onClick={createBatch}><Plus size={16}/>Crear lote</button></div><div className="panel-body upload-grid"><div className="grid"><label className="field"><span>Nombre del lote</span><input className="input" value={batchName} onChange={(event) => setBatchName(event.target.value)}/></label><label className="field"><span>BLs</span><textarea className="textarea" value={raw} onChange={(event) => setRaw(event.target.value)}/></label><label className="btn btn-secondary file-button"><FileSpreadsheet size={16}/>Cargar CSV/TXT<input type="file" hidden accept=".csv,.txt,.tsv" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setRaw(String(reader.result ?? "")); reader.readAsText(file); }}/></label></div><div className="card flat"><p className="panel-title">Validacion previa</p><ul className="helper-list"><li>Formato permitido: letras, numeros y guiones.</li><li>Duplicados del lote y resultados vigentes se omiten.</li><li>El usuario inicia manualmente el procesamiento.</li><li>Cada item tiene maximo 10 intentos.</li></ul></div></div></section><Filters filters={filters} setFilters={setFilters} total={allItems.length} filtered={filtered.length}/><section className="panel"><div className="panel-header"><div><p className="panel-title">Dashboard de consultas</p><p className="panel-subtitle">Doble clic en una fila para ver detalle. La exportacion respeta los filtros aplicados.</p></div>{batches[0] && <span className={badgeClass(batches[0].estado)}>{statusLabel(batches[0].estado)}</span>}</div><Table rows={filtered} select={setSelected} retry={retry}/></section></main>{selected && <Detail item={selected} close={() => setSelected(null)}/>} {toast && <div className="toast">{toast}</div>}</div>;
}

function resolveDemo(item: Item): Item { const now = new Date().toISOString(); if (item.identificadorNormalizado.endsWith("230")) return { ...item, estado: "error_temporal", ultimoStatusHttp: 403, ultimoError: "Aduanas rechazo la solicitud con 403 Forbidden.", updatedAt: now }; if (item.identificadorNormalizado.endsWith("300")) return { ...item, estado: "sin_resultado", ultimoError: "No se detectaron resultados visibles para este BL.", updatedAt: now }; return { ...item, estado: "exitoso", updatedAt: now, resultado: { nroBl: item.identificadorNormalizado, nroManifesto: "271842", nave: item.identificadorNormalizado.includes("MED") ? "MSC TIANPING" : "MAERSK LIMA", sentido: "INGRESO", fechaArriboZarpeEstimado: "21/06/2026 23:00", ciaNaviera: "MSC CHILE S.A.", almacen: "SAN ANTONIO TERMINAL INTERNACIONAL S.A.", puertoEmbarque: "Ningbo", puertoDesembarque: "San Antonio", totalPeso: 18274.3, fuente: "Aduanas Chile", consultedAt: now } }; }
function withTotals(batch: Batch): Batch { const totalExitosos = batch.items.filter((i) => i.estado === "exitoso").length; const totalSinResultado = batch.items.filter((i) => i.estado === "sin_resultado").length; const totalFallidos = batch.items.filter((i) => ["error_temporal", "agotado_por_reintentos"].includes(i.estado)).length; return { ...batch, totalItems: batch.items.length, totalExitosos, totalSinResultado, totalFallidos, totalReintentos: batch.items.reduce((sum, item) => sum + Math.max(0, item.intentoActual - 1), 0) }; }
function Login({ onLogin }: { onLogin: () => void }) { return <main className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><Ship size={24}/></div><h1>KPO BL Tracker</h1><p>Acceso interno para usuarios autorizados.</p></div><div className="panel"><div className="panel-body grid"><label className="field"><span>Correo</span><input className="input" defaultValue="admin@kposervices.cl"/></label><label className="field"><span>Contrasena</span><input className="input" type="password" placeholder="Demo: puedes entrar sin clave"/></label><button className="btn btn-primary" onClick={onLogin}>Iniciar sesion</button><div className="alert"><strong>Registro cerrado</strong><span>Las cuentas nuevas deben ser creadas por un administrador.</span></div></div></div></div></main>; }
function SourceStrip() { return <div className="grid status-grid"><div className="card source-card"><strong>Aduanas Chile - BL Maritimo</strong><span>POST confirmado. Fuente activa.</span></div><div className="card source-card"><strong>Logs HTML temporales</strong><span>Retencion tecnica: 1 dia.</span></div><div className="card source-card warning"><strong>Worker secuencial</strong><span>Pendiente red final y presupuesto Railway.</span></div></div>; }
function Summary({ items }: { items: Item[] }) { const cards = [["Total BL", items.length], ["Exitosos", items.filter((i) => i.estado === "exitoso").length], ["Pendientes", items.filter((i) => ["validado", "pendiente", "en_proceso"].includes(i.estado)).length], ["Alertas", items.filter((i) => ["sin_resultado", "error_temporal", "agotado_por_reintentos"].includes(i.estado)).length]]; return <div className="grid summary-grid">{cards.map(([label, value]) => <div className="card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>)}</div>; }
function Filters({ filters, setFilters, total, filtered }: { filters: Filters; setFilters: (f: Filters) => void; total: number; filtered: number }) { return <div className="panel filters"><label className="field"><span>Buscar BL, manifiesto, nave o puerto</span><div className="search"><Search size={16}/><input className="input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}/></div></label><label className="field"><span>Estado</span><select className="select" value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value as Filters["estado"] })}><option value="all">Todos</option><option value="exitoso">Exitosos</option><option value="sin_resultado">Sin resultado</option><option value="error_temporal">Error temporal</option><option value="validado">Pendientes</option></select></label><label className="field"><span>Puerto</span><select className="select" value={filters.puerto} onChange={(e) => setFilters({ ...filters, puerto: e.target.value })}><option value="all">Todos</option><option>San Antonio</option><option>Valparaiso</option><option>Ningbo</option></select></label><p className="metric-note">{filtered === total ? `${total} registros` : `${filtered} de ${total} registros`}</p></div>; }
function Table({ rows, select, retry }: { rows: Item[]; select: (i: Item) => void; retry: (i: Item) => void }) { if (!rows.length) return <div className="empty">No hay BL para mostrar.</div>; return <div className="table-wrap"><table><thead><tr><th>Estado</th><th>Nro BL</th><th>Nro Manifiesto</th><th>Nave</th><th>Fecha Arribo/Zarpe</th><th>Cia Naviera</th><th>Almacen</th><th>Puerto Embarque</th><th>Puerto Desembarque</th><th>Total Peso</th><th>Intentos</th><th>Accion</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} onDoubleClick={() => select(item)}><td><span className={badgeClass(item.estado)}>{statusLabel(item.estado)}</span></td><td><strong>{item.resultado?.nroBl ?? item.identificadorNormalizado}</strong>{item.ultimoError && <div className="metric-note">{item.ultimoError}</div>}</td><td>{item.resultado?.nroManifesto ?? "-"}</td><td>{item.resultado?.nave ?? "-"}</td><td>{item.resultado?.fechaArriboZarpeEstimado ?? "-"}</td><td>{item.resultado?.ciaNaviera ?? "-"}</td><td>{item.resultado?.almacen ?? "-"}</td><td>{item.resultado?.puertoEmbarque ?? "-"}</td><td>{item.resultado?.puertoDesembarque ?? "-"}</td><td>{item.resultado?.totalPeso ?? "-"}</td><td>{item.intentoActual}/{item.maxIntentos}</td><td><button className="row-action" onClick={() => select(item)}>Ver detalle</button>{item.ultimoError && <button className="row-action" onClick={() => retry(item)}><RotateCcw size={14}/></button>}</td></tr>)}</tbody></table></div>; }
function Detail({ item, close }: { item: Item; close: () => void }) { const result = item.resultado; const rows = [["Nro BL", result?.nroBl ?? item.identificadorNormalizado], ["Nro Manifiesto", result?.nroManifesto], ["Nave", result?.nave], ["Sentido", result?.sentido], ["Cia Naviera", result?.ciaNaviera], ["Almacen", result?.almacen], ["Puerto Embarque", result?.puertoEmbarque], ["Puerto Desembarque", result?.puertoDesembarque], ["Error", item.ultimoError]]; return <div className="detail-dialog"><div className="detail-panel"><div className="panel-header"><div><p className="panel-title">Detalle de consulta</p><p className="panel-subtitle">{item.identificadorNormalizado}</p></div><button className="btn btn-secondary" onClick={close}><X size={16}/></button></div><div className="panel-body detail-grid">{rows.map(([label, value]) => <div className="detail-item" key={label}><span>{label}</span><strong>{value || "-"}</strong></div>)}</div></div></div>; }
