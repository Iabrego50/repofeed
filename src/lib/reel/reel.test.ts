import { describe, expect, it } from "vitest";
import { fitText, parseEmphasis, wrapTokens } from "./text.ts";
import { buildTimeline, sceneDuration } from "./timing.ts";

// Fixed-width fake measurement: each character is 0.5 × font size.
const measure = (text: string, size: number) => text.length * size * 0.5;

describe("parseEmphasis", () => {
  it("marks words inside asterisks", () => {
    expect(parseEmphasis("Why do *they actually* leave?")).toEqual([
      { word: "Why", em: false },
      { word: "do", em: false },
      { word: "they", em: true },
      { word: "actually", em: true },
      { word: "leave?", em: false },
    ]);
  });

  it("strips asterisks when emphasis is disabled", () => {
    expect(parseEmphasis("a *b* c", false).every((t) => !t.em)).toBe(true);
    expect(parseEmphasis("a *b* c", false).map((t) => t.word)).toEqual(["a", "b", "c"]);
  });
});

describe("wrapTokens", () => {
  it("wraps words onto new lines when they exceed max width", () => {
    const lines = wrapTokens(parseEmphasis("aaaa bbbb cccc"), 100, 20, measure);
    // "aaaa bbbb" = 9 chars × 10 = 90 ≤ 100; adding " cccc" exceeds.
    expect(lines.map((l) => l.tokens.map((t) => t.word).join(" "))).toEqual(["aaaa bbbb", "cccc"]);
  });
});

describe("fitText", () => {
  it("keeps the start size when text fits", () => {
    const r = fitText(parseEmphasis("short"), { maxWidth: 1000, maxLines: 2, startSize: 100, minSize: 40 }, measure);
    expect(r.size).toBe(100);
    expect(r.lines).toHaveLength(1);
  });

  it("shrinks until the text fits in max lines", () => {
    const tokens = parseEmphasis("one two three four five six seven eight");
    const r = fitText(tokens, { maxWidth: 400, maxLines: 2, startSize: 100, minSize: 20 }, measure);
    expect(r.size).toBeLessThan(100);
    expect(r.lines.length).toBeLessThanOrEqual(2);
    for (const l of r.lines) expect(l.width).toBeLessThanOrEqual(400);
  });

  it("stops at the minimum size", () => {
    const r = fitText(parseEmphasis("x".repeat(500)), { maxWidth: 100, maxLines: 1, startSize: 60, minSize: 40 }, measure);
    expect(r.size).toBe(40);
  });
});

describe("sceneDuration", () => {
  it("clamps hooks between 2.2 and 4.4 seconds", () => {
    expect(sceneDuration({ type: "hook", text: "Hi" })).toBe(2.2);
    expect(sceneDuration({ type: "hook", text: "one two three four five six" })).toBeCloseTo(3.1);
    expect(sceneDuration({ type: "hook", text: Array(20).fill("w").join(" ") })).toBe(4.4);
  });

  it("times lists by item count", () => {
    expect(sceneDuration({ type: "list", title: "x", items: ["a", "b", "c"] })).toBeCloseTo(4.0);
  });

  it("uses fixed times for stats and ctas", () => {
    expect(sceneDuration({ type: "stat", num: "46%", label: "x" })).toBe(3.2);
    expect(sceneDuration({ type: "cta", text: "x", sub: "y" })).toBe(2.9);
  });

  it("clamps quotes between 4 and 10 seconds", () => {
    expect(sceneDuration({ type: "quote", text: "Short one", by: "x" })).toBe(4);
    expect(sceneDuration({ type: "quote", text: Array(40).fill("w").join(" "), by: "x" })).toBe(10);
  });

  it("ignores emphasis asterisks when counting words", () => {
    expect(sceneDuration({ type: "line", text: "*one* two *three* four five six" })).toBeCloseTo(3.1);
  });

  it("builds a cumulative timeline", () => {
    const tl = buildTimeline([
      { type: "stat", num: "1", label: "x" },
      { type: "cta", text: "x", sub: "y" },
    ]);
    expect(tl.starts).toEqual([0, 3.2]);
    expect(tl.total).toBeCloseTo(6.1);
  });
});
