import { loadDemoBatches, resetDemoBatches, saveDemoBatches } from "./local-store";
import { isSupabaseMode } from "./supabase-client";
import { SupabaseBatchRepository } from "./supabase-batch-repository";
import type { BlBatch } from "./types";

export interface BatchRepository {
  list(): Promise<BlBatch[]>;
  saveAll(batches: BlBatch[]): Promise<void>;
  reset(): Promise<BlBatch[]>;
}

class LocalBatchRepository implements BatchRepository {
  async list(): Promise<BlBatch[]> {
    return loadDemoBatches();
  }

  async saveAll(batches: BlBatch[]): Promise<void> {
    saveDemoBatches(batches);
  }

  async reset(): Promise<BlBatch[]> {
    return resetDemoBatches();
  }
}

export const localBatchRepository: BatchRepository = new LocalBatchRepository();

// Selector segun VITE_AUTH_MODE: demo -> localStorage, supabase -> Supabase.
// SupabaseBatchRepository solo se instancia (y lee env) si el modo es supabase.
export const batchRepository: BatchRepository = isSupabaseMode()
  ? new SupabaseBatchRepository()
  : localBatchRepository;
