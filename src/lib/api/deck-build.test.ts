import { describe, expect, it } from "vitest";
import { collectEvidence, evidencePrompt, sanitizeDeck } from "./deck-build";

const evidence = collectEvidence([
  {
    title: "Help that became homework",
    track: "What customers say",
    scenes: [
      { type: "hook", text: "When does a meal kit stop *helping*?" },
      { type: "quote", text: "It stopped feeling like help and started feeling like homework.", by: "Parent of two, 7 months" },
      { type: "stat", num: "7 of 10", label: "said it started to feel like an obligation" },
      { type: "cta", text: "Obligation is the *churn signal*." },
    ],
  },
]);
const opts = { scopeLabel: "Meal-kit study", hasReactions: false };

describe("collectEvidence", () => {
  it("pulls quotes, figures and the takeaway out of scenes, without emphasis marks", () => {
    expect(evidence.reels[0]).toMatchObject({ hook: "When does a meal kit stop helping?", takeaway: "Obligation is the churn signal." });
    expect(evidencePrompt(evidence)).toContain('Quote: "It stopped feeling like help and started feeling like homework." (Parent of two, 7 months)');
  });
});

describe("sanitizeDeck", () => {
  const raw = {
    slides: [
      { type: "summary", headline: "What we learned", items: ["Kits turn into a chore after a few months."] },
      {
        type: "finding",
        headline: "The kit starts to feel like an obligation.",
        reelTitle: "help that became homework",
        quotes: [
          { text: "It stopped feeling like help and started feeling like homework", by: "Someone else" },
          { text: "I would pay double for this.", by: "Invented" },
        ],
        stats: [
          { num: "7 of 10", label: "felt obligated" },
          { num: "93%", label: "made up" },
        ],
      },
      { type: "voices", headline: "In their words", quotes: [{ text: "Nobody said this.", by: "Nobody" }] },
      { type: "reactions", headline: "The team agreed." },
      { type: "banana", headline: "Not a slide" },
    ],
  };
  const slides = sanitizeDeck(raw, evidence, opts);

  it("adds a title and closing slide when the model leaves them out", () => {
    expect(slides[0]).toMatchObject({ type: "title", headline: "Meal-kit study" });
    expect(slides.at(-1)?.type).toBe("closing");
  });

  it("keeps only quotes and figures that exist in the scenes, restoring the real speaker", () => {
    const finding = slides.find((s) => s.type === "finding")!;
    expect(finding.quotes).toEqual([{ text: "It stopped feeling like help and started feeling like homework.", by: "Parent of two, 7 months" }]);
    expect(finding.stats).toEqual([{ num: "7 of 10", label: "felt obligated" }]);
    expect(finding.reelTitle).toBe("Help that became homework");
  });

  it("drops slides left with nothing to show, unknown types, and reactions nobody gave", () => {
    expect(slides.map((s) => s.type)).toEqual(["title", "summary", "finding", "closing"]);
  });

  it("refuses a deck with no findings at all", () => {
    expect(() => sanitizeDeck({ slides: [{ type: "title", headline: "Hi" }] }, evidence, opts)).toThrow(/without any findings/);
  });
});
