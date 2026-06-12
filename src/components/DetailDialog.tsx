import { X } from "lucide-react";
import { formatNumber } from "../lib/format";
import type { BlItem } from "../lib/types";

export function DetailDialog({ item, close }: { item: BlItem; close: () => void }) {
  const result = item.resultado;
  const rows: Array<[string, string | undefined]> = [
    ["Nro BL", result?.nroBl ?? item.identificadorNormalizado],
    ["Nro Manifiesto", result?.nroManifesto],
    ["Nave", result?.nave],
    ["Sentido", result?.sentido],
    ["Fecha estimada", result?.fechaArriboZarpeEstimado],
    ["Cia Naviera", result?.ciaNaviera],
    ["Fecha emision manifiesto", result?.fechaEmisionManifiesto],
    ["Almacen", result?.almacen],
    ["Puerto Embarque", result?.puertoEmbarque],
    ["Puerto Desembarque", result?.puertoDesembarque],
    ["Total Peso", formatNumber(result?.totalPeso)],
    ["Intentos", `${item.intentoActual}/${item.maxIntentos}`],
    ["Error", item.ultimoError]
  ];

  return (
    <div className="detail-dialog">
      <div className="detail-panel">
        <div className="panel-header">
          <div><p className="panel-title">Detalle de consulta</p><p className="panel-subtitle">{item.identificadorNormalizado}</p></div>
          <button className="btn btn-secondary" type="button" onClick={close}><X size={16} /></button>
        </div>
        <div className="panel-body detail-grid">
          {rows.map(([label, value]) => <div className="detail-item" key={label}><span>{label}</span><strong>{value || "-"}</strong></div>)}
        </div>
      </div>
    </div>
  );
}
