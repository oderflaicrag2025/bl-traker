import { describe, expect, it } from "vitest";
import { splitDelimitedText } from "./file-import";

describe("file import", () => {
  it("splits pasted CSV TSV and text values", () => {
    expect(splitDelimitedText("MEDUWU951960, MAEU269371924\nNGMZ61113300\tMAEU269768230")).toEqual([
      "MEDUWU951960",
      "MAEU269371924",
      "NGMZ61113300",
      "MAEU269768230"
    ]);
  });
});
