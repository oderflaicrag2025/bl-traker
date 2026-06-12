import { loadDemoBatches, resetDemoBatches, saveDemoBatches } from "./local-store";
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
