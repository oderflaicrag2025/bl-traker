import ExcelJS from "exceljs";
import type { BlItem } from "./types";

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

  workbook.worksheets.forEach((worksheet) => {
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, fileName: `KPO_BL_Tracker_${new Date().toISOString().slice(0, 10)}.xlsx` };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
