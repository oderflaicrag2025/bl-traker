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

export function saveDemoBatches(batches: BlBatch[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

export function resetDemoBatches(): BlBatch[] {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return [demoBatch];
}
