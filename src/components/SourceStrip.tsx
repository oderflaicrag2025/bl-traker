import { formatDateTime } from "../lib/format";
import type { SourceHealth } from "../lib/types";

export function SourceStrip({ sources }: { sources: SourceHealth[] }) {
  return (
    <div className="grid status-grid">
      {sources.map((source) => {
        const actualizado = source.ultimoExito ?? source.ultimoIntento;
        return (
          <div className={`card source-card ${source.estado !== "activa" ? "warning" : ""}`} key={source.id}>
            <strong>{source.nombre}</strong>
            <span>Estado: {source.estado}</span>
            <span className="source-updated">Ultima actualizacion: {formatDateTime(actualizado)} (hora Chile)</span>
            <span>{source.mensaje}</span>
          </div>
        );
      })}
    </div>
  );
}
