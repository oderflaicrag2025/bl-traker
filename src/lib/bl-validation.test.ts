import { describe, expect, it } from "vitest";
import { MAX_BATCH_SIZE, normalizeBl, parseBlInput } from "./bl-validation";

describe("BL validation", () => {
  it("normalizes spaces and casing", () => {
    expect(normalizeBl(" medu wu951960 ")).toBe("MEDUWU951960");
  });

  it("separates valid, duplicate and invalid rows", () => {
    const parsed = parseBlInput("MEDUWU951960\nMEDUWU951960\n***\nMAEU269371924");
    expect(parsed.validRows.map((row) => row.normalized)).toEqual(["MEDUWU951960", "MAEU269371924"]);
    expect(parsed.duplicateRows).toHaveLength(1);
    expect(parsed.invalidRows).toHaveLength(1);
  });

  it("marks duplicates against current valid results", () => {
    const parsed = parseBlInput("MEDUWU951960\nMAEU269371924", new Set(["MEDUWU951960"]));
    expect(parsed.validRows.map((row) => row.normalized)).toEqual(["MAEU269371924"]);
    expect(parsed.duplicateRows[0].reason).toBe("Ya existe resultado vigente");
  });

  it("enforces the initial MVP batch limit", () => {
    const raw = Array.from({ length: MAX_BATCH_SIZE + 3 }, (_, index) => `BL${index}ABC`).join("\n");
    const parsed = parseBlInput(raw);
    expect(parsed.truncated).toBe(true);
    expect(parsed.rows).toHaveLength(MAX_BATCH_SIZE);
  });
});
