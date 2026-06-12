import type { SourceHealth } from "../lib/types";

export function SourceStrip({ sources }: { sources: SourceHealth[] }) {
  return (
    <div className="grid status-grid">
      {sources.map((source) => (
        <div className={`card source-card ${source.estado !== "activa" ? "warning" : ""}`} key={source.id}>
          <strong>{source.nombre}</strong>
          <span>Estado: {source.estado}</span>
          <span>{source.mensaje}</span>
        </div>
      ))}
    </div>
  );
}
