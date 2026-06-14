import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseBlInput } from "./bl-validation";
import { generatePreviewExcel } from "./excel-report";

// jsdom no implementa Blob.prototype.arrayBuffer; lo poligonamos con FileReader.
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

describe("excel report", () => {
  it("generates upload preview workbook with expected sheets", async () => {
    const preview = parseBlInput("MEDUWU951960\nMEDUWU951960\n***");
    const { blob, fileName } = await generatePreviewExcel(preview);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());

    expect(fileName).toMatch(/^KPO_BL_Preview_/);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Validos", "Duplicados", "Invalidos", "Resumen"]);
    expect(workbook.getWorksheet("Validos")?.rowCount).toBe(2);
    expect(workbook.getWorksheet("Duplicados")?.rowCount).toBe(2);
    expect(workbook.getWorksheet("Invalidos")?.rowCount).toBe(2);
  });
});
