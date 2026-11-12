import { collectEvidence } from "@/lib/api/deck-build.ts";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import { DEMO_REELS } from "./demo-reels.ts";
import { DEMO_INSIGHT_ROWS, DEMO_INSIGHT_SUMMARY } from "./demo-insights.ts";
import { SAMPLE_STUDY } from "./sample.ts";

/**
 * The readout deck for the public demo study. It is assembled from the demo
 * scenes with the same evidence rules as a real deck (quotes and figures come
 * straight from scenes), so visitors see what they would get for their own study.
 */
export function buildDemoDeck(): Deck {
  const evidence = collectEvidence(DEMO_REELS.map((r) => ({ title: r.title, scenes: r.scenes })));
  const withEvidence = evidence.reels.filter((r) => r.quotes.length && r.stats.length).slice(0, 4);
  const summary = DEMO_INSIGHT_SUMMARY;
  return {
    id: "demo-deck",
    _id: "demo-deck",
    _creationTime: Date.now(),
    scopeLabel: SAMPLE_STUDY.title,
    slides: [
      { type: "title", headline: "Why people cancel their meal kit", body: "Exit interviews and the cancellation survey, for the retention team." },
      { type: "summary", headline: "What we learned", items: evidence.reels.map((r) => r.takeaway).filter(Boolean).slice(0, 4) },
      ...withEvidence.map((r) => ({ type: "finding" as const, headline: r.takeaway || r.title, quotes: [r.quotes[0]], stats: r.stats.slice(0, 2), reelTitle: r.title })),
      { type: "reactions", headline: "The team agreed with most findings and pushed back on plan size." },
      {
        type: "next_steps",
        headline: "What we recommend",
        items: [
          "Test a three-night plan against the current four-night default.",
          "Add a pause option to the cancel flow before the final step.",
          "Move the skip reminder to the day before the cutoff.",
          "Re-interview paused subscribers after eight weeks.",
        ],
      },
      { type: "closing", headline: "Next: pricing test brief by Friday" },
    ],
    stats: {
      reached: summary.reached,
      memberCount: summary.memberCount,
      guestsReached: summary.guestsReached,
      completionRate: summary.completionRate,
      openItems: summary.openItems,
      totalViews: summary.totalViews,
      reactions: summary.reactions,
    },
    reels: DEMO_INSIGHT_ROWS.map((row) => ({
      id: row.reelId,
      title: row.title,
      viewers: row.viewers,
      completionRate: row.completionRate,
      trueCount: row.trueCount,
      surprisedCount: row.surprisedCount,
      pushbackCount: row.pushbackCount,
    })),
  } as unknown as Deck;
}
