import { describe, expect, it } from "vitest";
import successHtml from "../fixtures/aduanas-success.html?raw";
import emptyHtml from "../fixtures/aduanas-empty.html?raw";
import forbiddenHtml from "../fixtures/aduanas-403.html?raw";
import { extractPageCode, parseAduanasMaritimeHtml } from "./aduanas-parser";

describe("parseAduanasMaritimeHtml", () => {
  it("extracts maritime manifest and BL fields from successful HTML", () => {
    const parsed = parseAduanasMaritimeHtml(successHtml, 200);
    expect(parsed.status).toBe("success");
    expect(parsed.result?.nroManifesto).toBe("271842");
    expect(parsed.result?.nave).toBe("MSC TIANPING");
    expect(parsed.result?.ciaNaviera).toBe("MSC CHILE S.A.");
  });

  it("classifies 403 without treating it as parser failure", () => {
    const parsed = parseAduanasMaritimeHtml(forbiddenHtml, 403);
    expect(parsed.status).toBe("forbidden");
    expect(parsed.message).toContain("403");
  });

  it("detects no-result pages and extracts the dynamic page code", () => {
    const parsed = parseAduanasMaritimeHtml(emptyHtml, 200);
    expect(parsed.status).toBe("no_result");
    expect(extractPageCode(emptyHtml)).toBe("6208859");
  });
});
