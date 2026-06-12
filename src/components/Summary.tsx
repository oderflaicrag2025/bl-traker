import type { BlItem } from "../lib/types";

export function Summary({ items }: { items: BlItem[] }) {
  const cards = [
    ["Total BL", items.length],
    ["Exitosos", items.filter((item) => item.estado === "exitoso").length],
    ["Pendientes", items.filter((item) => ["validado", "pendiente", "en_proceso"].includes(item.estado)).length],
    ["Alertas", items.filter((item) => ["sin_resultado", "error_temporal", "agotado_por_reintentos"].includes(item.estado)).length]
  ];

  return (
    <div className="grid summary-grid">
      {cards.map(([label, value]) => (
        <div className="card" key={label}>
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
        </div>
      ))}
    </div>
  );
}
