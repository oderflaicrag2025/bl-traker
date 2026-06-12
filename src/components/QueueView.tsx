import { Play, RotateCcw } from "lucide-react";
import { badgeClass, statusLabel } from "../lib/status";
import type { BlBatch } from "../lib/types";

interface QueueViewProps {
  batches: BlBatch[];
  processingBatchId: string | null;
  onProcess: (id: string) => void;
  onRetryFailed: (id: string) => void;
  onCancel: (batch: BlBatch) => void;
}

export function QueueView({ batches, processingBatchId, onProcess, onRetryFailed, onCancel }: QueueViewProps) {
  return (
    <section className="panel">
      <div className="panel-header"><div><p className="panel-title">Cola de consulta</p><p className="panel-subtitle">Lotes locales con progreso, cancelacion y reintento de fallidos.</p></div></div>
      <div className="queue-list">
        {batches.map((batch) => {
          const done = batch.totalExitosos + batch.totalFallidos + batch.totalSinResultado;
          const progress = batch.totalItems ? Math.round((done / batch.totalItems) * 100) : 0;
          return (
            <div className="queue-item" key={batch.id}>
              <div>
                <strong>{batch.nombreLote}</strong>
                <div className="metric-note">{batch.totalItems} items | {batch.totalExitosos} exitosos | {batch.totalFallidos + batch.totalSinResultado} alertas</div>
                <div className="progress"><span style={{ width: `${progress}%` }} /></div>
              </div>
              <span className={badgeClass(batch.estado)}>{statusLabel(batch.estado)}</span>
              <button className="btn btn-secondary" disabled={Boolean(processingBatchId)} onClick={() => onProcess(batch.id)}><Play size={16} />Procesar</button>
              <button className="btn btn-secondary" disabled={Boolean(processingBatchId)} onClick={() => onRetryFailed(batch.id)}><RotateCcw size={16} />Reintentar fallidos</button>
              <button className="btn btn-danger" disabled={Boolean(processingBatchId)} onClick={() => onCancel(batch)}>Cancelar</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
