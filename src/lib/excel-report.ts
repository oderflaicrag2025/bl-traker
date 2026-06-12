import ExcelJS from "exceljs";
import type { BlItem, UploadPreview, UploadPreviewRow } from "./types";

export async function generateBlExcel(items: BlItem[]): Promise<{ blob: Blob; fileName: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KPO BL Tracker";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Resultados");
  sheet.columns = [
    "Lote", "Fecha consulta", "Estado item", "Nro BL", "Nro Manifiesto", "Nave", "Sentido", "Fecha Arribo/Zarpe Estimado", "Cia Naviera", "Fecha Emision Manifiesto", "Emisor BL", "Fecha Emision BL", "Fecha Aceptacion", "Fecha Embarque", "Almacen", "Puerto Embarque", "Puerto Desembarque", "Ultimo Transbordo", "Total Peso", "Fuente", "Intentos", "Error Resumen"
  ].map((header) => ({ header, key: header, width: 24 }));

  items.forEach((item) => {
    const result = item.resultado;
    sheet.addRow({
      "Lote": item.loteId,
      "Fecha consulta": result?.consultedAt ?? item.updatedAt,
      "Estado item": item.estado,
      "Nro BL": result?.nroBl ?? item.identificadorNormalizado,
      "Nro Manifiesto": result?.nroManifesto,
      "Nave": result?.nave,
      "Sentido": result?.sentido,
      "Fecha Arribo/Zarpe Estimado": result?.fechaArriboZarpeEstimado,
      "Cia Naviera": result?.ciaNaviera,
      "Fecha Emision Manifiesto": result?.fechaEmisionManifiesto,
      "Emisor BL": result?.emisor,
      "Fecha Emision BL": result?.fechaEmisionBl,
      "Fecha Aceptacion": result?.fechaAceptacion,
      "Fecha Embarque": result?.fechaEmbarque,
      "Almacen": result?.almacen,
      "Puerto Embarque": result?.puertoEmbarque,
      "Puerto Desembarque": result?.puertoDesembarque,
      "Ultimo Transbordo": result?.ultimoTransbordo,
      "Total Peso": result?.totalPeso,
      "Fuente": result?.fuente ?? "Aduanas Chile",
      "Intentos": item.intentoActual,
      "Error Resumen": item.ultimoError
    });
  });

  const errors = items.filter((item) => item.ultimoError || item.error);
  if (errors.length) {
    const errorSheet = workbook.addWorksheet("Errores");
    errorSheet.columns = ["Lote", "Identificador Original", "Identificador Normalizado", "Estado", "Tipo Error", "Mensaje Usuario", "Status HTTP", "Intento Actual", "Max Intentos", "Fecha Error"].map((header) => ({ header, key: header, width: 28 }));
    errors.forEach((item) => errorSheet.addRow({
      "Lote": item.loteId,
      "Identificador Original": item.identificadorOriginal,
      "Identificador Normalizado": item.identificadorNormalizado,
      "Estado": item.estado,
      "Tipo Error": item.error?.tipoError ?? "sin_resultado",
      "Mensaje Usuario": item.error?.mensajeUsuario ?? item.ultimoError,
      "Status HTTP": item.error?.statusHttp ?? item.ultimoStatusHttp,
      "Intento Actual": item.intentoActual,
      "Max Intentos": item.maxIntentos,
      "Fecha Error": item.error?.createdAt ?? item.updatedAt
    }));
  }

  applyWorkbookFormatting(workbook);
  return workbookToDownload(workbook, `KPO_BL_Tracker_${todayStamp()}.xlsx`);
}

export async function generatePreviewExcel(preview: UploadPreview): Promise<{ blob: Blob; fileName: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KPO BL Tracker";
  workbook.created = new Date();

  addPreviewSheet(workbook, "Validos", preview.validRows);
  addPreviewSheet(workbook, "Duplicados", preview.duplicateRows);
  addPreviewSheet(workbook, "Invalidos", preview.invalidRows);

  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [
    { header: "Categoria", key: "categoria", width: 24 },
    { header: "Total", key: "total", width: 14 }
  ];
  summary.addRows([
    { categoria: "Validos", total: preview.validRows.length },
    { categoria: "Duplicados", total: preview.duplicateRows.length },
    { categoria: "Invalidos", total: preview.invalidRows.length },
    { categoria: "Total revisado", total: preview.rows.length },
    { categoria: "Truncado por limite", total: preview.truncated ? "Si" : "No" }
  ]);

  applyWorkbookFormatting(workbook);
  return workbookToDownload(workbook, `KPO_BL_Preview_${todayStamp()}.xlsx`);
}

function addPreviewSheet(workbook: ExcelJS.Workbook, name: string, rows: UploadPreviewRow[]): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: "Posicion", key: "position", width: 12 },
    { header: "Original", key: "original", width: 28 },
    { header: "Normalizado", key: "normalized", width: 28 },
    { header: "Valido", key: "valid", width: 12 },
    { header: "Duplicado", key: "duplicated", width: 14 },
    { header: "Motivo", key: "reason", width: 36 }
  ];
  rows.forEach((row) => sheet.addRow({
    position: row.position,
    original: row.original,
    normalized: row.normalized,
    valid: row.valid ? "Si" : "No",
    duplicated: row.duplicated ? "Si" : "No",
    reason: row.reason ?? "Listo para lote"
  }));
}

function applyWorkbookFormatting(workbook: ExcelJS.Workbook): void {
  workbook.worksheets.forEach((worksheet) => {
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    worksheet.autoFilter = worksheet.rowCount > 1 ? { from: "A1", to: `${worksheet.getColumn(worksheet.columnCount).letter}1` } : undefined;
  });
}

async function workbookToDownload(workbook: ExcelJS.Workbook, fileName: string): Promise<{ blob: Blob; fileName: string }> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, fileName };
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
