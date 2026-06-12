import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Header, type AppView } from "./components/Header";
import { SourceStrip } from "./components/SourceStrip";
import { Summary } from "./components/Summary";
import { UploadPanel } from "./components/UploadPanel";
import { FiltersBar } from "./components/FiltersBar";
import { BlTable } from "./components/BlTable";
import { QueueView } from "./components/QueueView";
import { AdminView } from "./components/AdminView";
import { DetailDialog } from "./components/DetailDialog";
import { Login } from "./components/Login";
import { parseBlInput } from "./lib/bl-validation";
import { cancelBatch, createBatchFromRows, filterItems, resetItemForRetry, resolveDemoItem, withBatchTotals } from "./lib/batch-engine";
import { sourceHealth } from "./lib/demo-data";
import { downloadBlob, generateBlExcel, generatePreviewExcel } from "./lib/excel-report";
import { todayBatchName } from "./lib/format";
import { parseUploadFile } from "./lib/file-import";
import { localBatchRepository } from "./lib/batch-repository";
import type { BlBatch, BlItem, DashboardFilters, UploadPreview } from "./lib/types";

export function App() {
  const [logged, setLogged] = useState(import.meta.env.VITE_AUTH_MODE !== "supabase");
  const [view, setView] = useState<AppView>("dashboard");
  const [batches, setBatches] = useState<BlBatch[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [raw, setRaw] = useState("MAEU269371924\nMAEU269768230\nMEDUWU951960");
  const [batchName, setBatchName] = useState(todayBatchName());
  const [filters, setFilters] = useState<DashboardFilters>({ search: "", estado: "all", puerto: "all", dateFrom: "", dateTo: "" });
  const [preview, setPreview] = useState<UploadPreview>(() => parseBlInput(raw));
  const [selected, setSelected] = useState<BlItem | null>(null);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    localBatchRepository.list().then((stored) => {
      setBatches(stored);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) void localBatchRepository.saveAll(batches);
  }, [batches, hydrated]);

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

  async function exportPreviewExcel() {
    if (!preview.rows.length) return notify("No hay validacion previa para exportar.");
    const { blob, fileName } = await generatePreviewExcel(preview);
    downloadBlob(blob, fileName);
    notify(`Preview exportado: ${fileName}`);
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
        <div className="alert"><AlertTriangle size={17} /><div><strong>Modo demo sin Supabase</strong><div>Este bloque adelanta carga, cola, exportacion, logs y administracion local. Luego se reemplaza el almacenamiento por Supabase.</div></div></div>
        <SourceStrip sources={sourceHealth} />
        <Summary items={allItems} />
        {view === "dashboard" && <>
          <UploadPanel raw={raw} preview={preview} batchName={batchName} setBatchName={setBatchName} onRaw={updateRaw} onFile={handleFile} onCreate={createBatch} onExportPreview={exportPreviewExcel} />
          <FiltersBar filters={filters} setFilters={setFilters} total={allItems.length} filtered={filtered.length} />
          <section className="panel">
            <div className="panel-header">
              <div><p className="panel-title">Dashboard de consultas</p><p className="panel-subtitle">Doble clic en una fila para ver detalle. La exportacion respeta filtros.</p></div>
            </div>
            <BlTable rows={filtered} select={setSelected} retry={retryItem} />
          </section>
        </>}
        {view === "queue" && <QueueView batches={batches} processingBatchId={processingBatchId} onProcess={(id) => void processBatch(id)} onRetryFailed={retryFailed} onCancel={(batch) => setBatches((current) => replaceBatch(current, cancelBatch(batch)))} />}
        {view === "admin" && <AdminView logs={technicalLogs} />}
      </main>
      {selected && <DetailDialog item={selected} close={() => setSelected(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function replaceBatch(current: BlBatch[], next: BlBatch): BlBatch[] {
  return current.map((batch) => batch.id === next.id ? next : batch);
}
