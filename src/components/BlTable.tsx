import { RotateCcw } from "lucide-react";
import { formatNumber } from "../lib/format";
import { badgeClass, statusLabel } from "../lib/status";
import type { BlItem } from "../lib/types";

interface BlTableProps {
  rows: BlItem[];
  select: (item: BlItem) => void;
  retry: (item: BlItem) => void;
}

export function BlTable({ rows, select, retry }: BlTableProps) {
  if (!rows.length) return <div className="empty">No hay BL para mostrar.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Estado</th><th>Nro BL</th><th>Nro Manifiesto</th><th>Nave</th><th>Fecha Arribo/Zarpe</th><th>Cia Naviera</th><th>Almacen</th><th>Puerto Embarque</th><th>Puerto Desembarque</th><th>Total Peso</th><th>Intentos</th><th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} onDoubleClick={() => select(item)}>
              <td><span className={badgeClass(item.estado)}>{statusLabel(item.estado)}</span></td>
              <td><strong>{item.resultado?.nroBl ?? item.identificadorNormalizado}</strong>{item.ultimoError && <div className="metric-note">{item.ultimoError}</div>}</td>
              <td>{item.resultado?.nroManifesto ?? "-"}</td>
              <td>{item.resultado?.nave ?? "-"}</td>
              <td>{item.resultado?.fechaArriboZarpeEstimado ?? "-"}</td>
              <td>{item.resultado?.ciaNaviera ?? "-"}</td>
              <td>{item.resultado?.almacen ?? "-"}</td>
              <td>{item.resultado?.puertoEmbarque ?? "-"}</td>
              <td>{item.resultado?.puertoDesembarque ?? "-"}</td>
              <td>{formatNumber(item.resultado?.totalPeso)}</td>
              <td>{item.intentoActual}/{item.maxIntentos}</td>
              <td>
                <button className="row-action" onClick={() => select(item)}>Ver detalle</button>
                {item.ultimoError && <button className="row-action" onClick={() => retry(item)}><RotateCcw size={14} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
