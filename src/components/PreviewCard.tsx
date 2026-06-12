import { MAX_BATCH_SIZE } from "../lib/bl-validation";
import type { UploadPreview } from "../lib/types";

export function PreviewCard({ preview }: { preview: UploadPreview }) {
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
          <table>
            <tbody>
              {preview.rows.slice(0, 8).map((row) => (
                <tr key={`${row.position}-${row.normalized}`}>
                  <td>{row.position}</td>
                  <td>{row.normalized}</td>
                  <td>{row.reason ?? "Listo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
