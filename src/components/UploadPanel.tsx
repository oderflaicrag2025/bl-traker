import { FileSpreadsheet, Plus } from "lucide-react";
import { MAX_BATCH_SIZE } from "../lib/bl-validation";
import type { UploadPreview } from "../lib/types";

interface UploadPanelProps {
  raw: string;
  preview: UploadPreview;
  batchName: string;
  setBatchName: (value: string) => void;
  onRaw: (value: string) => void;
  onFile: (file?: File) => void | Promise<void>;
  onCreate: () => void;
}

export function UploadPanel({ raw, preview, batchName, setBatchName, onRaw, onFile, onCreate }: UploadPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-title">Carga de BL maritimos</p>
          <p className="panel-subtitle">Pegado manual, CSV/TXT o Excel. Limite inicial: {MAX_BATCH_SIZE} registros por lote.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={onCreate} disabled={!preview.validRows.length}>
          <Plus size={16} />Crear lote
        </button>
      </div>
      <div className="panel-body upload-grid">
        <div className="grid">
          <label className="field">
            <span>Nombre del lote</span>
            <input className="input" value={batchName} onChange={(event) => setBatchName(event.target.value)} />
          </label>
          <label className="field">
            <span>BLs</span>
            <textarea className="textarea" value={raw} onChange={(event) => onRaw(event.target.value)} placeholder="Un BL por linea o separados por coma" />
          </label>
          <label className="btn btn-secondary file-button">
            <FileSpreadsheet size={16} />Cargar Excel/CSV/TXT
            <input type="file" hidden accept=".xlsx,.xls,.csv,.txt,.tsv" onChange={(event) => void onFile(event.target.files?.[0])} />
          </label>
        </div>
        <PreviewCard preview={preview} />
      </div>
    </section>
  );
}

function PreviewCard({ preview }: { preview: UploadPreview }) {
  return (
    <div className="card flat">
      <p className="panel-title">Validacion previa</p>
      <div className="preview-grid">
        <div><strong>{preview.validRows.length}</strong><span>validos</span></div>
        <div><strong>{preview.duplicateRows.length}</strong><span>duplicados</span></div>
        <div><strong>{preview.invalidRows.length}</strong><span>invalidos</span></div>
      </div>
      <ul className="helper-list">
        <li>Formato permitido: letras, numeros y guiones.</li>
        <li>Duplicados del lote y resultados vigentes se omiten.</li>
        <li>El usuario inicia manualmente el procesamiento.</li>
        <li>Cada item tiene maximo 10 intentos.</li>
        {preview.truncated && <li>Se aplico el limite de {MAX_BATCH_SIZE} registros.</li>}
      </ul>
      {preview.rows.length > 0 && (
        <div className="preview-table">
          <table><tbody>{preview.rows.slice(0, 8).map((row) => <tr key={`${row.position}-${row.normalized}`}><td>{row.position}</td><td>{row.normalized}</td><td>{row.reason ?? "Listo"}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
