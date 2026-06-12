import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, LogOut, PauseCircle, Play, Plus, RefreshCw, RotateCcw, Search, Ship, ShieldCheck, X } from "lucide-react";
import { MAX_BATCH_SIZE, parseBlInput } from "./lib/bl-validation";
import { cancelBatch, createBatchFromRows, filterItems, resetItemForRetry, resolveDemoItem, withBatchTotals } from "./lib/batch-engine";
import { demoUsers, sourceHealth } from "./lib/demo-data";
import { downloadBlob, generateBlExcel } from "./lib/excel-report";
import { formatDateTime, formatNumber, todayBatchName } from "./lib/format";
import { parseUploadFile } from "./lib/file-import";
import { loadDemoBatches, saveDemoBatches } from "./lib/local-store";
import { badgeClass, statusLabel } from "./lib/status";
import type { BlBatch, BlItem, DashboardFilters, UploadPreview } from "./lib/types";

type View = "dashboard" | "queue" | "admin";

export function App() {
  const [logged, setLogged] = useState(import.meta.env.VITE_AUTH_MODE !== "supabase");
  const [view, setView] = useState<View>("dashboard");
  const [batches, setBatches] = useState<BlBatch[]>(() => loadDemoBatches());
  const [raw, setRaw] = useState("MAEU269371924\nMAEU269768230\nMEDUWU951960");
  const [batchName, setBatchName] = useState(todayBatchName());
  const [filters, setFilters] = useState<DashboardFilters>({ search: "", estado: "all", puerto: "all", dateFrom: "", dateTo: "" });
  const [preview, setPreview] = useState<UploadPreview>(() => parseBlInput(raw));
  const [selected, setSelected] = useState<BlItem | null>(null);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    saveDemoBatches(batches);
  }, [batches]);

  const allItems = useMemo(() => batches.flatMap((batch) => batch.items), [batches]);
  const currentResults = useMemo(() => new Set(allItems.filter((item) => item.estado === "exitoso").map((item) => item.identificadorNormalizado)), [allItems]);
  const filtered = useMemo(() => filterItems(allItems, filters), [allItems, filters]);
  const latestBatch = batches[0];
  const technicalLogs = useMemo(() => allItems.filter((item) => item.error || item.ultimoStatusHttp || item.ultimoError), [allItems]);

  if (!logged) return <Login onLogin={() => setLogged(true)} />;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  function updateRaw(value: string) {
    setRaw(value);
    setPreview(parseBlInput(value, currentResults));
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const nextPreview = await parseUploadFile(file, currentResults);
    setPreview(nextPreview);
    setRaw(nextPreview.rows.map((row) => row.original).join("\n"));
    setBatchName(file.name.replace(/\.[^.]+$/, ""));
    notify(`Archivo cargado: ${nextPreview.validRows.length} BL validos.`);
  }

  function createBatch() {
    if (!preview.validRows.length) return notify("No hay BL validos para crear un lote.");
    const batch = createBatchFromRows(batchName, preview.validRows, preview.fileName);
    setBatches((current) => [batch, ...current]);
    setPreview(parseBlInput("", new Set([...currentResults, ...batch.items.map((item) => item.identificadorNormalizado)])));
    setRaw("");
    notify(`Lote creado con ${batch.items.length} BL validos.`);
  }

  async function processBatch(batchId?: string) {
    const candidate = batches.find((batch) => batch.id === batchId) ?? batches.find((batch) => ["validado", "en_cola", "completado_con_errores"].includes(batch.estado));
    if (!candidate) return notify("No hay lote validado para procesar.");
    cancelRef.current = false;
    setProcessingBatchId(candidate.id);
    let next: BlBatch = { ...candidate, estado: "procesando", startedAt: new Date().toISOString(), finishedAt: undefined };
    setBatches((current) => replaceBatch(current, next));

    for (const item of next.items) {
      if (cancelRef.current) {
        next = cancelBatch(next);
        setBatches((current) => replaceBatch(current, next));
        setProcessingBatchId(null);
        notify("Lote cancelado por el usuario.");
        return;
      }
      if (!["validado", "pendiente", "error_temporal", "sin_resultado"].includes(item.estado)) continue;
      next = { ...next, items: next.items.map((row) => row.id === item.id ? { ...row, estado: "en_proceso", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : row) };
      setBatches((current) => replaceBatch(current, withBatchTotals(next)));
      await new Promise((resolve) => window.setTimeout(resolve, 550));
      next = { ...next, items: next.items.map((row) => row.id === item.id ? resolveDemoItem(row) : row) };
      setBatches((current) => replaceBatch(current, withBatchTotals(next)));
    }

    next = withBatchTotals({ ...next, estado: next.totalFallidos || next.totalSinResultado ? "completado_con_errores" : "completado", finishedAt: new Date().toISOString() });
    setBatches((current) => replaceBatch(current, next));
    setProcessingBatchId(null);
    notify("Procesamiento finalizado con trazabilidad por item.");
  }

  function requestCancel() {
    cancelRef.current = true;
  }

  function retryItem(item: BlItem) {
    setBatches((current) => current.map((batch) => batch.id === item.loteId ? resetItemForRetry(batch, item.id) : batch));
    notify(`BL ${item.identificadorNormalizado} preparado para reintento manual.`);
  }

  function retryFailed(batchId: string) {
    setBatches((current) => current.map((batch) => batch.id === batchId ? batch.items.reduce((next, item) => item.ultimoError ? resetItemForRetry(next, item.id) : next, batch) : batch));
    notify("Fallidos preparados para reintento controlado.");
  }

  async function exportExcel() {
    if (!filtered.length) return notify("No hay filas para exportar.");
    const { blob, fileName } = await generateBlExcel(filtered);
    downloadBlob(blob, fileName);
    notify(`Excel generado: ${fileName}`);
  }

  return (
    <div>
      <Header view={view} setView={setView} latestBatch={latestBatch} processing={Boolean(processingBatchId)} onExport={() => void exportExcel()} canExport={filtered.length > 0} onProcess={() => void processBatch()} onCancel={requestCancel} onLogout={() => setLogged(false)} />
      <main className="container main grid">
        <div className="alert"><AlertTriangle size={17}/><div><strong>Modo demo sin Supabase</strong><div>Este bloque adelanta carga, cola, exportacion, logs y administracion local. Luego se reemplaza el almacenamiento por Supabase.</div></div></div>
        <SourceStrip />
        <Summary items={allItems} />
        {view === "dashboard" && <DashboardView raw={raw} preview={preview} batchName={batchName} filters={filters} rows={filtered} allCount={allItems.length} latestBatch={latestBatch} setBatchName={setBatchName} setFilters={setFilters} onRaw={updateRaw} onFile={handleFile} onCreate={createBatch} onSelect={setSelected} onRetry={retryItem} />}
        {view === "queue" && <QueueView batches={batches} processingBatchId={processingBatchId} onProcess={(id) => void processBatch(id)} onRetryFailed={retryFailed} onCancel={(batch) => setBatches((current) => replaceBatch(current, cancelBatch(batch)))} />}
        {view === "admin" && <AdminView logs={technicalLogs} />}
      </main>
      {selected && <Detail item={selected} close={() => setSelected(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function replaceBatch(current: BlBatch[], next: BlBatch): BlBatch[] {
  return current.map((batch) => batch.id === next.id ? next : batch);
}

function Header({ view, setView, latestBatch, processing, onExport, canExport, onProcess, onCancel, onLogout }: { view: View; setView: (view: View) => void; latestBatch?: BlBatch; processing: boolean; onExport: () => void; canExport: boolean; onProcess: () => void; onCancel: () => void; onLogout: () => void }) {
  return <header className="app-header"><div className="container header-inner"><div className="brand"><div className="brand-mark"><Ship size={22}/></div><div><h1>KPO BL Tracker</h1><p>{latestBatch?.finishedAt ? `Ultima actualizacion: ${formatDateTime(latestBatch.finishedAt)}` : "Sistema interno de consulta BL"}</p></div></div><div className="header-actions"><nav className="view-tabs"><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button><button className={view === "queue" ? "active" : ""} onClick={() => setView("queue")}>Cola</button><button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin</button></nav><button className="btn btn-ghost" disabled={processing} onClick={onProcess}><Play size={16}/>{processing ? "Procesando..." : "Procesar"}</button>{processing && <button className="btn btn-ghost" onClick={onCancel}><PauseCircle size={16}/>Cancelar</button>}<button className="btn btn-white" disabled={!canExport} onClick={onExport}><Download size={16}/>Excel</button><span className="badge info">admin</span><button className="btn btn-ghost" onClick={onLogout}><LogOut size={16}/>Salir</button></div></div></header>;
}

function Login({ onLogin }: { onLogin: () => void }) {
  return <main className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><Ship size={24}/></div><h1>KPO BL Tracker</h1><p>Acceso interno para usuarios autorizados.</p></div><div className="panel"><div className="panel-body grid"><label className="field"><span>Correo</span><input className="input" defaultValue="admin@kposervices.cl"/></label><label className="field"><span>Contrasena</span><input className="input" type="password" placeholder="Demo: puedes entrar sin clave"/></label><button className="btn btn-primary" onClick={onLogin}>Iniciar sesion</button><div className="alert"><strong>Registro cerrado</strong><span>Las cuentas nuevas deben ser creadas por un administrador.</span></div></div></div></div></main>;
}

function SourceStrip() {
  return <div className="grid status-grid">{sourceHealth.map((source) => <div className={`card source-card ${source.estado !== "activa" ? "warning" : ""}`} key={source.id}><strong>{source.nombre}</strong><span>Estado: {source.estado}</span><span>{source.mensaje}</span></div>)}</div>;
}

function Summary({ items }: { items: BlItem[] }) {
  const cards = [["Total BL", items.length], ["Exitosos", items.filter((i) => i.estado === "exitoso").length], ["Pendientes", items.filter((i) => ["validado", "pendiente", "en_proceso"].includes(i.estado)).length], ["Alertas", items.filter((i) => ["sin_resultado", "error_temporal", "agotado_por_reintentos"].includes(i.estado)).length]];
  return <div className="grid summary-grid">{cards.map(([label, value]) => <div className="card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>)}</div>;
}

function DashboardView({ raw, preview, batchName, filters, rows, allCount, latestBatch, setBatchName, setFilters, onRaw, onFile, onCreate, onSelect, onRetry }: { raw: string; preview: UploadPreview; batchName: string; filters: DashboardFilters; rows: BlItem[]; allCount: number; latestBatch?: BlBatch; setBatchName: (value: string) => void; setFilters: (value: DashboardFilters) => void; onRaw: (value: string) => void; onFile: (file?: File) => void | Promise<void>; onCreate: () => void; onSelect: (item: BlItem) => void; onRetry: (item: BlItem) => void }) {
  return <><section className="panel"><div className="panel-header"><div><p className="panel-title">Carga de BL maritimos</p><p className="panel-subtitle">Pegado manual, CSV/TXT o Excel. Limite inicial: {MAX_BATCH_SIZE} registros por lote.</p></div><button className="btn btn-primary" onClick={onCreate} disabled={!preview.validRows.length}><Plus size={16}/>Crear lote</button></div><div className="panel-body upload-grid"><div className="grid"><label className="field"><span>Nombre del lote</span><input className="input" value={batchName} onChange={(event) => setBatchName(event.target.value)}/></label><label className="field"><span>BLs</span><textarea className="textarea" value={raw} onChange={(event) => onRaw(event.target.value)} placeholder="Un BL por linea o separados por coma"/></label><label className="btn btn-secondary file-button"><FileSpreadsheet size={16}/>Cargar Excel/CSV/TXT<input type="file" hidden accept=".xlsx,.xls,.csv,.txt,.tsv" onChange={(event) => void onFile(event.target.files?.[0])}/></label></div><PreviewCard preview={preview}/></div></section><Filters filters={filters} setFilters={setFilters} total={allCount} filtered={rows.length}/><section className="panel"><div className="panel-header"><div><p className="panel-title">Dashboard de consultas</p><p className="panel-subtitle">Doble clic en una fila para ver detalle. La exportacion respeta filtros.</p></div>{latestBatch && <span className={badgeClass(latestBatch.estado)}>{statusLabel(latestBatch.estado)}</span>}</div><Table rows={rows} select={onSelect} retry={onRetry}/></section></>;
}

function PreviewCard({ preview }: { preview: UploadPreview }) {
  return <div className="card flat"><p className="panel-title">Validacion previa</p><div className="preview-grid"><div><strong>{preview.validRows.length}</strong><span>validos</span></div><div><strong>{preview.duplicateRows.length}</strong><span>duplicados</span></div><div><strong>{preview.invalidRows.length}</strong><span>invalidos</span></div></div><ul className="helper-list"><li>Formato permitido: letras, numeros y guiones.</li><li>Duplicados del lote y resultados vigentes se omiten.</li><li>El usuario inicia manualmente el procesamiento.</li><li>Cada item tiene maximo 10 intentos.</li>{preview.truncated && <li>Se aplico el limite de {MAX_BATCH_SIZE} registros.</li>}</ul>{preview.rows.length > 0 && <div className="preview-table"><table><tbody>{preview.rows.slice(0, 8).map((row) => <tr key={`${row.position}-${row.normalized}`}><td>{row.position}</td><td>{row.normalized}</td><td>{row.reason ?? "Listo"}</td></tr>)}</tbody></table></div>}</div>;
}

function Filters({ filters, setFilters, total, filtered }: { filters: DashboardFilters; setFilters: (f: DashboardFilters) => void; total: number; filtered: number }) {
  return <div className="panel filters"><label className="field"><span>Buscar BL, manifiesto, nave o puerto</span><div className="search"><Search size={16}/><input className="input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}/></div></label><label className="field"><span>Estado</span><select className="select" value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value as DashboardFilters["estado"] })}><option value="all">Todos</option><option value="exitoso">Exitosos</option><option value="sin_resultado">Sin resultado</option><option value="error_temporal">Error temporal</option><option value="agotado_por_reintentos">Agotados</option><option value="validado">Pendientes</option></select></label><label className="field"><span>Puerto</span><select className="select" value={filters.puerto} onChange={(e) => setFilters({ ...filters, puerto: e.target.value })}><option value="all">Todos</option><option>San Antonio</option><option>Valparaiso</option><option>Ningbo</option></select></label><label className="field"><span>Desde</span><input className="input" type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}/></label><label className="field"><span>Hasta</span><input className="input" type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}/></label><p className="metric-note">{filtered === total ? `${total} registros` : `${filtered} de ${total} registros`}</p></div>;
}

function QueueView({ batches, processingBatchId, onProcess, onRetryFailed, onCancel }: { batches: BlBatch[]; processingBatchId: string | null; onProcess: (id: string) => void; onRetryFailed: (id: string) => void; onCancel: (batch: BlBatch) => void }) {
  return <section className="panel"><div className="panel-header"><div><p className="panel-title">Cola de consulta</p><p className="panel-subtitle">Lotes locales con progreso, cancelacion y reintento de fallidos.</p></div></div><div className="queue-list">{batches.map((batch) => <div className="queue-item" key={batch.id}><div><strong>{batch.nombreLote}</strong><div className="metric-note">{batch.totalItems} items | {batch.totalExitosos} exitosos | {batch.totalFallidos + batch.totalSinResultado} alertas</div><div className="progress"><span style={{ width: `${batch.totalItems ? Math.round(((batch.totalExitosos + batch.totalFallidos + batch.totalSinResultado) / batch.totalItems) * 100) : 0}%` }}/></div></div><span className={badgeClass(batch.estado)}>{statusLabel(batch.estado)}</span><button className="btn btn-secondary" disabled={Boolean(processingBatchId)} onClick={() => onProcess(batch.id)}><Play size={16}/>Procesar</button><button className="btn btn-secondary" disabled={Boolean(processingBatchId)} onClick={() => onRetryFailed(batch.id)}><RotateCcw size={16}/>Reintentar fallidos</button><button className="btn btn-danger" disabled={Boolean(processingBatchId)} onClick={() => onCancel(batch)}>Cancelar</button></div>)}</div></section>;
}

function Table({ rows, select, retry }: { rows: BlItem[]; select: (i: BlItem) => void; retry: (i: BlItem) => void }) {
  if (!rows.length) return <div className="empty">No hay BL para mostrar.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Estado</th><th>Nro BL</th><th>Nro Manifiesto</th><th>Nave</th><th>Fecha Arribo/Zarpe</th><th>Cia Naviera</th><th>Almacen</th><th>Puerto Embarque</th><th>Puerto Desembarque</th><th>Total Peso</th><th>Intentos</th><th>Accion</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} onDoubleClick={() => select(item)}><td><span className={badgeClass(item.estado)}>{statusLabel(item.estado)}</span></td><td><strong>{item.resultado?.nroBl ?? item.identificadorNormalizado}</strong>{item.ultimoError && <div className="metric-note">{item.ultimoError}</div>}</td><td>{item.resultado?.nroManifesto ?? "-"}</td><td>{item.resultado?.nave ?? "-"}</td><td>{item.resultado?.fechaArriboZarpeEstimado ?? "-"}</td><td>{item.resultado?.ciaNaviera ?? "-"}</td><td>{item.resultado?.almacen ?? "-"}</td><td>{item.resultado?.puertoEmbarque ?? "-"}</td><td>{item.resultado?.puertoDesembarque ?? "-"}</td><td>{formatNumber(item.resultado?.totalPeso)}</td><td>{item.intentoActual}/{item.maxIntentos}</td><td><button className="row-action" onClick={() => select(item)}>Ver detalle</button>{item.ultimoError && <button className="row-action" onClick={() => retry(item)}><RotateCcw size={14}/></button>}</td></tr>)}</tbody></table></div>;
}

function AdminView({ logs }: { logs: BlItem[] }) {
  return <div className="grid"><section className="panel"><div className="panel-header"><div><p className="panel-title">Administracion demo</p><p className="panel-subtitle">Pantalla preparada para conectar perfiles Supabase despues.</p></div><ShieldCheck size={20}/></div><div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th></tr></thead><tbody>{demoUsers.map((user) => <tr key={user.id}><td>{user.email}</td><td>{user.nombre}</td><td><span className="badge info">{user.rol}</span></td><td>{user.activo ? "Si" : "No"}</td></tr>)}</tbody></table></div></section><section className="panel"><div className="panel-header"><div><p className="panel-title">Logs tecnicos demo</p><p className="panel-subtitle">En produccion solo admin vera este bloque y los logs expiraran en 1 dia.</p></div></div><div className="table-wrap"><table><thead><tr><th>BL</th><th>Estado</th><th>Status HTTP</th><th>Mensaje</th><th>Expira</th></tr></thead><tbody>{logs.map((item) => <tr key={item.id}><td>{item.identificadorNormalizado}</td><td>{statusLabel(item.estado)}</td><td>{item.ultimoStatusHttp ?? "-"}</td><td>{item.error?.detalleTecnico ?? item.ultimoError}</td><td>{formatDateTime(item.error?.expiresAt)}</td></tr>)}</tbody></table></div></section></div>;
}

function Detail({ item, close }: { item: BlItem; close: () => void }) {
  const result = item.resultado;
  const rows = [["Nro BL", result?.nroBl ?? item.identificadorNormalizado], ["Nro Manifiesto", result?.nroManifesto], ["Nave", result?.nave], ["Sentido", result?.sentido], ["Fecha estimada", result?.fechaArriboZarpeEstimado], ["Cia Naviera", result?.ciaNaviera], ["Fecha emision manifiesto", result?.fechaEmisionManifiesto], ["Almacen", result?.almacen], ["Puerto Embarque", result?.puertoEmbarque], ["Puerto Desembarque", result?.puertoDesembarque], ["Total Peso", formatNumber(result?.totalPeso)], ["Intentos", `${item.intentoActual}/${item.maxIntentos}`], ["Error", item.ultimoError]];
  return <div className="detail-dialog"><div className="detail-panel"><div className="panel-header"><div><p className="panel-title">Detalle de consulta</p><p className="panel-subtitle">{item.identificadorNormalizado}</p></div><button className="btn btn-secondary" onClick={close}><X size={16}/></button></div><div className="panel-body detail-grid">{rows.map(([label, value]) => <div className="detail-item" key={label}><span>{label}</span><strong>{value || "-"}</strong></div>)}</div></div></div>;
}
