import { describe, expect, it } from "vitest";
import type { Scene } from "@/schema/validators";
import {
  ASK_FULL_READ_LIMIT,
  askCandidates,
  citationParts,
  cleanTopics,
  keywordAnswer,
  rankInsights,
  sanitizeAnswer,
  sanitizeTopics,
  stem,
  terms,
  topicCounts,
  withTopics,
  type LibraryInsight,
} from "./research-search";

const scenes = (...parts: Scene[]): Scene[] => parts;
const insight = (id: string, title: string, topics: string[], body: Scene[]): LibraryInsight => ({
  id,
  title,
  track: "What customers say",
  studyTitle: "Meal-kit study",
  topics,
  scenes: body,
});

const LIB = [
  insight("a", "Why people really leave", ["cancellation", "pricing"], scenes(
    { type: "hook", text: "Why do people *cancel*?" },
    { type: "stat", num: "29%", label: "cancelled because of price" },
    { type: "cta", text: "Price leads, volume follows.", sub: "" },
  )),
  insight("b", "Help that became homework", ["meal planning", "habit"], scenes(
    { type: "quote", text: "It stopped feeling like help and started feeling like homework.", by: "Parent of two" },
    { type: "cta", text: "Obligation is the churn signal.", sub: "" },
  )),
  insight("c", "The forgotten skip", ["skipping", "cancellation"], scenes(
    { type: "quote", text: "I skipped four weeks in a row and kept forgetting to skip the fifth.", by: "Single professional" },
    { type: "cta", text: "Make skipping automatic.", sub: "" },
  )),
  insight("d", "What gets thrown out", ["food waste"], scenes(
    { type: "list", title: "Most wasted", items: ["Fresh herbs", "Half onions"] },
    { type: "cta", text: "Smaller portions cut waste.", sub: "" },
  )),
];

describe("stemming", () => {
  it("brings word forms together", () => {
    expect(new Set(["cancel", "cancels", "cancelled", "cancelling", "cancellation"].map(stem))).toEqual(new Set(["cancel"]));
    expect(stem("prices")).toBe(stem("price"));
    expect(stem("skipped")).toBe(stem("skip"));
    expect(stem("studies")).toBe("study");
    expect(stem("boxes")).toBe("box");
  });

  it("drops filler words from questions", () => {
    expect(terms("Why do people cancel their meal kit?")).toEqual(["cancel", "meal", "kit"]);
  });
});

describe("rankInsights", () => {
  it("finds insights by a different form of the word", () => {
    expect(rankInsights(LIB, "cancelling").map((r) => r.insight.id)).toEqual(expect.arrayContaining(["a", "c"]));
  });

  it("ranks a topic match above a passing mention", () => {
    expect(rankInsights(LIB, "food waste")[0].insight.id).toBe("d");
  });

  it("keeps partial matches for long questions and prefers the one covering more of it", () => {
    const ranked = rankInsights(LIB, "do people cancel because of the price?");
    expect(ranked[0].insight.id).toBe("a");
  });

  it("shows where in the scene the match is", () => {
    expect(rankInsights(LIB, "homework")[0].snippet).toMatch(/homework/);
  });

  it("returns nothing for an empty or filler-only query", () => {
    expect(rankInsights(LIB, "")).toEqual([]);
    expect(rankInsights(LIB, "what is the")).toEqual([]);
  });
});

describe("topics", () => {
  it("cleans and limits topics", () => {
    expect(cleanTopics(["  Cancellation Flow ", "#Pricing", "pricing", "a very long topic phrase here", "", 4, "one", "two", "three"])).toEqual([
      "cancellation flow",
      "pricing",
      "one",
      "two",
    ]);
  });

  it("counts topics, most used first", () => {
    expect(topicCounts(LIB).slice(0, 2)).toEqual([
      { topic: "cancellation", count: 2 },
      { topic: "food waste", count: 1 },
    ]);
  });

  it("filters by every chosen topic", () => {
    expect(withTopics(LIB, ["cancellation", "skipping"]).map((i) => i.id)).toEqual(["c"]);
  });

  it("keeps only tags for insights it was asked about", () => {
    const tags = sanitizeTopics({ insights: [{ id: "a", topics: ["Pricing"] }, { id: "zzz", topics: ["x"] }, { id: "b", topics: [] }] }, new Set(["a", "b"]));
    expect([...tags.entries()]).toEqual([["a", ["pricing"]]]);
  });
});

describe("asking a question", () => {
  it("lets the AI read every insight in a normal-sized workspace", () => {
    expect(askCandidates(LIB, "anything")).toHaveLength(LIB.length);
  });

  it("narrows a very large workspace to the best matches, padded to the limit", () => {
    const big = Array.from({ length: ASK_FULL_READ_LIMIT + 50 }, (_, i) => insight(`x${i}`, `Insight ${i}`, [], scenes({ type: "hook", text: "filler" })));
    const withTarget = [...big, LIB[3]];
    const picked = askCandidates(withTarget, "food waste");
    expect(picked).toHaveLength(ASK_FULL_READ_LIMIT);
    expect(picked[0].id).toBe("d");
  });

  it("drops insights the model made up and renumbers the citations", () => {
    const result = sanitizeAnswer(
      {
        answer: "Most leave over price [1], an invented reason [2], and some forget to skip [3].",
        insights: [
          { id: "a", why: "Price is the top reason." },
          { id: "not-real", why: "Invented" },
          { id: "c", why: "Skipping is easy to forget." },
        ],
      },
      new Set(LIB.map((i) => i.id)),
      4,
    );
    expect(result.insights.map((i) => i.id)).toEqual(["a", "c"]);
    expect(result.answer).toBe("Most leave over price [1], an invented reason, and some forget to skip [2].");
  });

  it("returns no answer when the model's answer is empty", () => {
    expect(sanitizeAnswer({ answer: "", insights: [] }, new Set(), 4)).toMatchObject({ answer: null, insights: [] });
  });

  it("falls back to keyword matches with no written answer", () => {
    expect(keywordAnswer(LIB, "skip")).toMatchObject({ mode: "keyword", answer: null, insights: [{ id: "c", why: null }] });
  });

  it("splits an answer into text and citations", () => {
    expect(citationParts("Price [1][2], then volume [3].")).toEqual([
      { text: "Price " },
      { cite: 1 },
      { cite: 2 },
      { text: ", then volume " },
      { cite: 3 },
      { text: "." },
    ]);
  });
});
