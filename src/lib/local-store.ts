import { demoBatch } from "./demo-data";
import type { BlBatch } from "./types";

const STORAGE_KEY = "kpo-bl-tracker-demo-batches";

export function loadDemoBatches(): BlBatch[] {
  if (typeof window === "undefined") return [demoBatch];
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [demoBatch];
  try {
    const parsed = JSON.parse(saved) as BlBatch[];
    return Array.isArray(parsed) && parsed.length ? parsed : [demoBatch];
  } catch {
    return [demoBatch];
  }
}

export class StorageQuotaError extends Error {
  constructor() {
    super("Se supero la capacidad del almacenamiento local del navegador.");
    this.name = "StorageQuotaError";
  }
}

export function saveDemoBatches(batches: BlBatch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch (error) {
    // localStorage ~5 MB: con muchos lotes (resultados + HTML) puede llenarse.
    // Aviso explicito en vez de fallar en silencio. Migrar a Supabase resuelve esto.
    if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      throw new StorageQuotaError();
    }
    throw error;
  }
}

export function resetDemoBatches(): BlBatch[] {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return [demoBatch];
}
