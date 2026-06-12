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

  it("enforces the initial MVP batch limit", () => {
    const raw = Array.from({ length: MAX_BATCH_SIZE + 3 }, (_, index) => `BL${index}ABC`).join("\n");
    const parsed = parseBlInput(raw);
    expect(parsed.truncated).toBe(true);
    expect(parsed.allRows).toHaveLength(MAX_BATCH_SIZE);
  });
});
