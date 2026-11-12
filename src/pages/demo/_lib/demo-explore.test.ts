import { describe, expect, it } from "vitest";
import { rankInsights, topicCounts } from "@/lib/research-search.ts";
import {
  DEMO_CANNED_ANSWERS,
  DEMO_SUGGESTED_QUESTIONS,
  askDemoResearch,
  demoInsights,
  demoSceneIndex,
  demoWatchHref,
} from "./demo-explore.ts";
import { demoReelId } from "./demo-interactions.ts";

describe("demo explore library", () => {
  const insights = demoInsights();

  it("builds searchable insights from the Supperly demo reels", () => {
    expect(insights.length).toBeGreaterThan(5);
    expect(insights.every((insight) => insight.topics.length > 0)).toBe(true);
    expect(insights.some((insight) => insight.title === "Help that became homework")).toBe(true);
    expect(topicCounts(insights).map((t) => t.topic)).toEqual(expect.arrayContaining(["cancellation", "food waste"]));
  });

  it("ranks keyword matches as you type, using the same rankInsights helper", () => {
    const ranked = rankInsights(insights, "homework");
    expect(ranked[0]?.insight.title).toBe("Help that became homework");
    expect(ranked[0]?.snippet).toMatch(/homework/i);
  });

  it("links a demo insight to the matching demo feed scene", () => {
    expect(demoSceneIndex(demoReelId(4))).toBe(4);
    expect(demoWatchHref(demoReelId(4))).toBe("/demo?scene=4");
  });

  it("returns a cited written answer for each suggested question, grounded in sample insights", () => {
    expect(DEMO_SUGGESTED_QUESTIONS).toEqual(DEMO_CANNED_ANSWERS.map((item) => item.question));
    for (const question of DEMO_SUGGESTED_QUESTIONS) {
      const result = askDemoResearch(question);
      expect(result.mode).toBe("ai");
      expect(result.answer).toMatch(/\[1\]/);
      expect(result.insights.length).toBeGreaterThan(0);
      for (const hit of result.insights) {
        expect(insights.some((insight) => insight.id === hit.id)).toBe(true);
      }
    }
  });

  it("falls back to keyword ranking for other questions and never invents insights", () => {
    const result = askDemoResearch("Do they mention mushrooms?");
    expect(result.mode).toBe("keyword");
    expect(result.answer).toBeNull();
    expect(result.notice).toBe("ai_unavailable");
    expect(result.insights.map((hit) => hit.id)).toContain(demoReelId(9));
  });

  it("keeps canned answers inside an active topic filter", () => {
    const result = askDemoResearch("What do people say about price?", ["pricing"]);
    expect(result.mode).toBe("ai");
    expect(result.insights.map((hit) => hit.id)).toEqual([demoReelId(0)]);
  });
});
