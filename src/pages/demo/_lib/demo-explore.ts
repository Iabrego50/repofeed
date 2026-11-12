import type { AskResponse } from "@/lib/api/explore.ts";
import {
  keywordAnswer,
  sanitizeAnswer,
  withTopics,
  type LibraryInsight,
} from "@/lib/research-search.ts";
import { buildDemoReels, demoReelId } from "./demo-interactions.ts";

/** Demo reel index used by `/demo?scene=`. */
export function demoSceneIndex(insightId: string): number {
  const match = /^demo-(\d+)$/.exec(insightId);
  return match ? Number(match[1]) : 0;
}

export function demoWatchHref(insightId: string): string {
  return `/demo?scene=${demoSceneIndex(insightId)}`;
}

export function demoInsights(): LibraryInsight[] {
  return buildDemoReels().map((reel) => ({
    id: reel.id,
    title: reel.title,
    track: reel.track,
    studyTitle: reel.studyTitle ?? "",
    topics: reel.topics,
    scenes: reel.scenes,
  }));
}

export const DEMO_SUGGESTED_QUESTIONS = [
  "What frustrates people most?",
  "What should we fix first?",
  "What do people say about price?",
];

type CannedAsk = {
  question: string;
  answer: string;
  insights: Array<{ id: string; why: string }>;
};

/**
 * Written answers for the suggested demo questions, citing only Supperly
 * sample insights. Anything else falls back to keyword ranking.
 */
export const DEMO_CANNED_ANSWERS: CannedAsk[] = [
  {
    question: "What frustrates people most?",
    answer:
      "The kit starts as help and turns into homework: people feel obliged to cook it [1]. A missed skip is often the first step toward cancelling [2]. By week two, unused ingredients go in the bin and the guilt piles up [3]. When they do leave, hiding the cancel button makes the last experience feel disrespectful [4].",
    insights: [
      { id: demoReelId(1), why: "Subscribers describe the kit as an obligation once the novelty wears off." },
      { id: demoReelId(2), why: "Forgetting to skip a week they didn't want is a common path to cancel." },
      { id: demoReelId(6), why: "Most diary homes threw out at least one ingredient in week two." },
      { id: demoReelId(7), why: "A seven-screen cancel flow leaves a bad last taste." },
    ],
  },
  {
    question: "What should we fix first?",
    answer:
      "Make pause one tap — 41% would have paused instead of cancelling [1]. Make skipping automatic, because a missed skip often becomes a cancel [2]. Offer a true three-night plan; the smallest option is still too much food [3]. And make leaving respectful instead of hiding the button [4].",
    insights: [
      { id: demoReelId(3), why: "A one-tap pause would have kept people who cancelled." },
      { id: demoReelId(2), why: "The cancel often starts with a missed skip." },
      { id: demoReelId(4), why: "Most homes want kits for just three nights a week." },
      { id: demoReelId(7), why: "Hard cancels leave a bad last taste." },
    ],
  },
  {
    question: "What do people say about price?",
    answer:
      "Price at full rate is the top survey reason for cancelling, at 29% [1]. It is not only price: too much food (22%) and repetitive recipes (17%) follow in the same list [1]. The takeaway from this scene is that volume and repetition sit right behind cost.",
    insights: [
      { id: demoReelId(0), why: "The exit survey ranks price first, then waste and repetition." },
    ],
  },
];

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[?!.,'’"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Client-side Ask for the public demo. Never calls the signed-in insights API. */
export function askDemoResearch(question: string, topics: string[] = []): AskResponse {
  const insights = withTopics(demoInsights(), topics);
  const canned = DEMO_CANNED_ANSWERS.find((item) => normalizeQuestion(item.question) === normalizeQuestion(question));
  if (canned) {
    const result = sanitizeAnswer(
      { answer: canned.answer, insights: canned.insights },
      new Set(insights.map((insight) => insight.id)),
      insights.length,
    );
    if (result.insights.length > 0) return result;
  }
  return { ...keywordAnswer(insights, question), notice: "ai_unavailable" };
}
