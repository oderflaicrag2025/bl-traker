import { useEffect } from "react";
import { X } from "lucide-react";
import { UploadPanel } from "./UploadPanel";
import type { UploadPreview } from "../lib/types";

interface UploadDialogProps {
  raw: string;
  preview: UploadPreview;
  batchName: string;
  setBatchName: (value: string) => void;
  onRaw: (value: string) => void;
  onFile: (file?: File) => void | Promise<void>;
  onCreate: () => void;
  onExportPreview: () => void | Promise<void>;
  close: () => void;
}

export function UploadDialog({ close, ...panel }: UploadDialogProps) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  return (
    <div
      className="detail-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="detail-panel">
        <div className="panel-header">
          <div>
            <p className="panel-title" id="upload-dialog-title">Busqueda masiva de BL</p>
            <p className="panel-subtitle">Sube los BL para una nueva consulta. Al crear el lote se cierra esta ventana.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={close} aria-label="Cerrar ventana de carga"><X size={16} aria-hidden="true" /></button>
        </div>
        <UploadPanel {...panel} />
      </div>
    </div>
  );
}
