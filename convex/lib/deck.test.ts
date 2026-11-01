import { describe, expect, test } from "vitest";
import { sanitizeDeck, type RawDeck } from "./deck";

const ctx = {
  reelTitles: ["It never learned me", "Help became homework"],
  comments: [{ body: "This matches what support hears every week.", by: "Dana", kind: "note", reel: "It never learned me" }],
  findings: [
    { type: "stat", text: "Most cancellers left within two months", number: "62%", label: "cancel by month two" },
    { type: "stat", text: "Weekly planning took too long", number: "25 min", label: "spent planning each week" },
    { type: "quote", text: "By week three it felt like homework, not help.", speaker: "P01" },
  ],
  fallbackTitle: "Supperly study",
};

describe("sanitizeDeck", () => {
  test("keeps only figures and quotes that trace back to findings", () => {
    const raw: RawDeck = {
      slides: [
        { type: "title", headline: "Why people cancel" },
        {
          type: "finding",
          headline: "Planning became a chore",
          reelTitle: "help became HOMEWORK",
          stats: [{ num: "62%", label: "left early" }, { num: "90%", label: "invented" }],
          quotes: [{ text: "\u201Cfelt like homework, not help.\u201D", by: "Wrong" }],
        },
        { type: "figures", headline: "Only one real figure", stats: [{ num: "62%", label: "a" }, { num: "13%", label: "b" }] },
        { type: "voices", headline: "Made up", quotes: [{ text: "Totally made up quote here", by: "X" }] },
        { type: "next_steps", headline: "Recs", items: ["Shorten planning", "  "] },
      ],
    };
    const out = sanitizeDeck(raw, ctx);
    expect(out.map((s) => s.type)).toEqual(["title", "finding", "next_steps"]);
    const finding = out[1];
    expect(finding.stats).toEqual([{ num: "62%", label: "left early" }]);
    // Verbatim excerpts are allowed; the speaker comes from the finding.
    expect(finding.quotes).toEqual([{ text: "felt like homework, not help.", by: "P01" }]);
    expect(finding.reelTitle).toBe("Help became homework");
    expect(out[2].items).toEqual(["Shorten planning"]);
  });

  test("drops engagement-only slide types and adds a title slide", () => {
    const raw: RawDeck = {
      slides: [
        { type: "reach", headline: "Views per reel" },
        { type: "summary", headline: "What we learned", items: ["A", "B"] },
        { type: "summary", headline: "Duplicate", items: ["C"] },
      ],
    };
    const out = sanitizeDeck(raw, ctx);
    expect(out.map((s) => s.type)).toEqual(["title", "summary"]);
    expect(out[0].headline).toBe("Supperly study");
  });

  test("falls back to team comments for voices only when there are no participant quotes", () => {
    const raw: RawDeck = {
      slides: [{ type: "voices", headline: "Voices", quotes: [{ text: "this matches what support hears every week.", by: "Wrong" }] }],
    };
    expect(sanitizeDeck(raw, ctx).find((s) => s.type === "voices")).toBeUndefined();
    const noQuotes = { ...ctx, findings: ctx.findings.filter((f) => f.type !== "quote") };
    const voices = sanitizeDeck(raw, noQuotes).find((s) => s.type === "voices");
    expect(voices?.quotes).toEqual([{ text: "This matches what support hears every week.", by: "Dana" }]);
  });
});
