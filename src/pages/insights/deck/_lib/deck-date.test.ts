import { describe, expect, it } from "vitest";
import { formatDeckDate } from "./deck.ts";

describe("formatDeckDate", () => {
  const fixedNow = Date.parse("2026-11-24T12:00:00.000Z");

  it("formats a valid millisecond timestamp", () => {
    expect(formatDeckDate(fixedNow, fixedNow)).toMatch(/2026/);
  });

  it("formats a valid ISO string", () => {
    expect(formatDeckDate("2026-03-15T00:00:00.000Z", fixedNow)).toMatch(/2026/);
  });

  it("falls back when the value is missing or invalid (no throw)", () => {
    for (const bad of [undefined, null, "", "not-a-date", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatDeckDate(bad, fixedNow)).not.toThrow();
      expect(formatDeckDate(bad, fixedNow)).toMatch(/2026/);
    }
  });

  it("does not throw RangeError for Invalid Date inputs used by cover slides", () => {
    expect(() => {
      // Same call path CoverSlide / exportPptx used before the guard.
      formatDeckDate(undefined);
      formatDeckDate(Number.NaN);
      formatDeckDate(null);
    }).not.toThrow();
  });
});
