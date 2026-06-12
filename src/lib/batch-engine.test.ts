import { describe, expect, it } from "vitest";
import { createBatchFromRows, resetItemForRetry, resolveDemoItem, withBatchTotals } from "./batch-engine";

describe("batch engine", () => {
  it("creates a valid batch from upload rows", () => {
    const batch = createBatchFromRows("Prueba", [{ original: " medu wu951960 ", normalized: "MEDUWU951960", position: 1 }]);
    expect(batch.estado).toBe("validado");
    expect(batch.items[0].identificadorNormalizado).toBe("MEDUWU951960");
  });

  it("turns repeated 403 demo item into exhausted at max attempts", () => {
    const batch = createBatchFromRows("Prueba", [{ original: "MAEU269768230", normalized: "MAEU269768230", position: 1 }]);
    const item = { ...batch.items[0], intentoActual: 9 };
    const resolved = resolveDemoItem(item);
    expect(resolved.estado).toBe("agotado_por_reintentos");
    expect(resolved.error?.reintentable).toBe(false);
  });

  it("recomputes totals and prepares failed item for retry", () => {
    const batch = createBatchFromRows("Prueba", [{ original: "NGMZ61113300", normalized: "NGMZ61113300", position: 1 }]);
    const failed = withBatchTotals({ ...batch, items: [resolveDemoItem(batch.items[0])] });
    const retry = resetItemForRetry(failed, failed.items[0].id);
    expect(retry.estado).toBe("validado");
    expect(retry.items[0].estado).toBe("validado");
  });
});
