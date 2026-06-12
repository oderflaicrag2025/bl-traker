import { FileSpreadsheet, Plus } from "lucide-react";
import { MAX_BATCH_SIZE } from "../lib/bl-validation";
import { badgeClass, statusLabel } from "../lib/status";
import type { BlBatch, BlItem, DashboardFilters, UploadPreview } from "../lib/types";
import { BlTable } from "./BlTable";
import { FiltersBar } from "./FiltersBar";
import { PreviewCard } from "./PreviewCard";

interface DashboardViewProps {
  raw: string;
  preview: UploadPreview;
  batchName: string;
  filters: DashboardFilters;
  rows: BlItem[];
  allCount: number;
  latestBatch?: BlBatch;
  setBatchName: (value: string) => void;
  setFilters: (value: DashboardFilters) => void;
  onRaw: (value: string) => void;
  onFile: (file?: File) => void | Promise<void>;
  onCreate: () => void;
  onSelect: (item: BlItem) => void;
  onRetry: (item: BlItem) => void;
}

export function DashboardView({ raw, preview, batchName, filters, rows, allCount, latestBatch, setBatchName, setFilters, onRaw, onFile, onCreate, onSelect, onRetry }: DashboardViewProps) {
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div><p className="panel-title">Carga de BL maritimos</p><p className="panel-subtitle">Pegado manual, CSV/TXT o Excel. Limite inicial: {MAX_BATCH_SIZE} registros por lote.</p></div>
          <button className="btn btn-primary" onClick={onCreate} disabled={!preview.validRows.length}><Plus size={16} />Crear lote</button>
        </div>
        <div className="panel-body upload-grid">
          <div className="grid">
            <label className="field"><span>Nombre del lote</span><input className="input" value={batchName} onChange={(event) => setBatchName(event.target.value)} /></label>
            <label className="field"><span>BLs</span><textarea className="textarea" value={raw} onChange={(event) => onRaw(event.target.value)} placeholder="Un BL por linea o separados por coma" /></label>
            <label className="btn btn-secondary file-button"><FileSpreadsheet size={16} />Cargar Excel/CSV/TXT<input type="file" hidden accept=".xlsx,.xls,.csv,.txt,.tsv" onChange={(event) => void onFile(event.target.files?.[0])} /></label>
          </div>
          <PreviewCard preview={preview} />
        </div>
      </section>
      <FiltersBar filters={filters} setFilters={setFilters} total={allCount} filtered={rows.length} />
      <section className="panel">
        <div className="panel-header">
          <div><p className="panel-title">Dashboard de consultas</p><p className="panel-subtitle">Doble clic en una fila para ver detalle. La exportacion respeta filtros.</p></div>
          {latestBatch && <span className={badgeClass(latestBatch.estado)}>{statusLabel(latestBatch.estado)}</span>}
        </div>
        <BlTable rows={rows} select={onSelect} retry={onRetry} />
      </section>
    </>
  );
}
