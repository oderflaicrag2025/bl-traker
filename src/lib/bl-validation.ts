import { z } from "zod";

export const MAX_BATCH_SIZE = 100;
export const blSchema = z.string().trim().min(4).max(30).regex(/^[A-Z0-9-]+$/i);

export function normalizeBl(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function parseBlInput(raw: string, currentResults: Set<string> = new Set()) {
  const candidates = raw.split(/[\n,;\t]+/).map((line) => line.trim()).filter(Boolean);
  const limited = candidates.slice(0, MAX_BATCH_SIZE);
  const seen = new Set<string>();
  const allRows = limited.map((original, index) => {
    const normalized = normalizeBl(original);
    const parsed = blSchema.safeParse(normalized);
    if (!parsed.success) return { original, normalized, position: index + 1, valid: false, reason: "Formato invalido" };
    if (seen.has(normalized)) return { original, normalized, position: index + 1, valid: true, duplicated: true, reason: "Duplicado dentro del lote" };
    seen.add(normalized);
    if (currentResults.has(normalized)) return { original, normalized, position: index + 1, valid: true, duplicated: true, reason: "Ya existe resultado vigente" };
    return { original, normalized, position: index + 1, valid: true, duplicated: false };
  });
  return {
    validRows: allRows.filter((row) => row.valid && !row.duplicated),
    invalidRows: allRows.filter((row) => !row.valid),
    duplicateRows: allRows.filter((row) => row.duplicated),
    allRows,
    truncated: candidates.length > MAX_BATCH_SIZE
  };
}
