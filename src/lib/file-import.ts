import ExcelJS from "exceljs";
import { buildUploadPreview } from "./bl-validation";
import type { UploadPreview } from "./types";

const BL_HEADER_CANDIDATES = ["bl", "nro bl", "nro de bl", "numero bl", "número bl", "bill of lading", "guia", "guía"];

export async function parseUploadFile(file: File, currentResults: Set<string> = new Set()): Promise<UploadPreview> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xls") {
    const values = await readExcelBlValues(file);
    return buildUploadPreview(values, currentResults, file.name);
  }
  const text = await file.text();
  return buildUploadPreview(splitDelimitedText(text), currentResults, file.name);
}

export function splitDelimitedText(text: string): string[] {
  return text.split(/[\n,;\t]+/).map((value) => value.trim()).filter(Boolean);
}

async function readExcelBlValues(file: File): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = sheet.getSheetValues().slice(1) as ExcelJS.CellValue[][];
  if (!rows.length) return [];

  const headerRow = rows.find((row) => Array.isArray(row) && row.some(Boolean)) ?? [];
  const headerIndex = findBlColumnIndex(headerRow);
  const startIndex = headerIndex === -1 ? 0 : 1;
  const columnIndex = headerIndex === -1 ? firstNonEmptyColumn(rows) : headerIndex;

  return rows.slice(startIndex).flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const cell = row[columnIndex];
    const value = cellToString(cell);
    return value ? [value] : [];
  });
}

function findBlColumnIndex(row: ExcelJS.CellValue[]): number {
  return row.findIndex((cell) => BL_HEADER_CANDIDATES.includes(cellToString(cell).toLowerCase().trim()));
}

function firstNonEmptyColumn(rows: ExcelJS.CellValue[][]): number {
  const counts = new Map<number, number>();
  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, index) => {
      if (index > 0 && cellToString(cell)) counts.set(index, (counts.get(index) ?? 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
}

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") {
    if ("text" in cell && cell.text) return String(cell.text);
    if ("result" in cell && cell.result !== undefined) return String(cell.result);
    if ("richText" in cell && Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join("");
  }
  return String(cell).trim();
}
