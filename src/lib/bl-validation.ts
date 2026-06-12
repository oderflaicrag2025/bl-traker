import { z } from "zod";
import type { UploadPreview, UploadPreviewRow } from "./types";

export const MAX_BATCH_SIZE = 100;
export const blSchema = z.string().trim().min(4).max(30).regex(/^[A-Z0-9-]+$/i);

export function normalizeBl(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function splitBlText(raw: string): string[] {
  return raw.split(/[\n,;\t]+/).map((line) => line.trim()).filter(Boolean);
}

export function parseBlInput(raw: string, currentResults: Set<string> = new Set(), fileName?: string): UploadPreview {
  return buildUploadPreview(splitBlText(raw), currentResults, fileName);
}

export function buildUploadPreview(values: string[], currentResults: Set<string> = new Set(), fileName?: string): UploadPreview {
  const limited = values.map((value) => value.trim()).filter(Boolean).slice(0, MAX_BATCH_SIZE);
  const seen = new Set<string>();
  const rows: UploadPreviewRow[] = limited.map((original, index) => {
    const normalized = normalizeBl(original);
    const parsed = blSchema.safeParse(normalized);
    if (!parsed.success) {
      return { original, normalized, position: index + 1, valid: false, duplicated: false, reason: "Formato invalido" };
    }
    if (seen.has(normalized)) {
      return { original, normalized, position: index + 1, valid: true, duplicated: true, reason: "Duplicado dentro del archivo/lote" };
    }
    seen.add(normalized);
    if (currentResults.has(normalized)) {
      return { original, normalized, position: index + 1, valid: true, duplicated: true, reason: "Ya existe resultado vigente" };
    }
    return { original, normalized, position: index + 1, valid: true, duplicated: false };
  });

  return {
    rows,
    validRows: rows.filter((row) => row.valid && !row.duplicated),
    invalidRows: rows.filter((row) => !row.valid),
    duplicateRows: rows.filter((row) => row.duplicated),
    truncated: values.length > MAX_BATCH_SIZE,
    fileName
  };
}
