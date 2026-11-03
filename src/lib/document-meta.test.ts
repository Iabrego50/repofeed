import { describe, expect, it } from "vitest";
import { NOT_FOUND_META, metaForPath } from "./document-meta";

describe("per-route document meta", () => {
  it("sets public titles and noindexes the 404 page", () => {
    expect(metaForPath("/").title).toMatch(/Research, as a feed/);
    expect(metaForPath("/demo").title).toMatch(/Demo/);
    expect(metaForPath("/help").title).toMatch(/Help/);
    expect(metaForPath("/signin").title).toMatch(/Sign in/);
    expect(metaForPath("/terms").title).toMatch(/Terms/);
    expect(metaForPath("/privacy").title).toMatch(/Privacy/);
    expect(metaForPath("/").title).toMatch(/Research, as a feed/);
    expect(metaForPath("/this-is-missing")).toEqual(NOT_FOUND_META);
    expect(NOT_FOUND_META.robots).toBe("noindex");
  });
});
