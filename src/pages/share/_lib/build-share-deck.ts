import { collectEvidence, type ReelLike } from "@/lib/api/deck-build.ts";
import type { Deck, DeckSlide } from "@/pages/insights/deck/_lib/deck.ts";

export type ShareDeckReel = ReelLike & { id: string };

/**
 * Builds a readout deck from a subset of shared-study scenes using the same
 * evidence rules as the researcher deck (quotes and figures come only from
 * scene content). No AI and no auth — suitable for share-link viewers.
 */
export function buildShareDeck(args: {
  studyTitle: string;
  reels: ShareDeckReel[];
}): Deck {
  const selected = args.reels.filter((r) => r.title?.trim());
  const evidence = collectEvidence(selected);
  const takeaways = evidence.reels.map((r) => r.takeaway || r.title).filter(Boolean);
  const findings = evidence.reels
    .filter((r) => r.quotes.length > 0 || r.stats.length > 0 || r.takeaway)
    .map((r) => {
      const slide: DeckSlide = {
        type: "finding",
        headline: r.takeaway || r.title,
        reelTitle: r.title,
      };
      if (r.quotes[0]) slide.quotes = [r.quotes[0]];
      if (r.stats.length) slide.stats = r.stats.slice(0, 2);
      return slide;
    });

  const slides: DeckSlide[] = [
    {
      type: "title",
      headline: args.studyTitle.trim() || "Research readout",
      body: selected.length === 1
        ? "One finding from the shared study."
        : `${selected.length} findings from the shared study.`,
    },
  ];

  if (takeaways.length > 0) {
    slides.push({
      type: "summary",
      headline: "What we learned",
      items: takeaways.slice(0, 5),
    });
  }

  slides.push(...findings.slice(0, 8));

  if (findings.length === 0 && takeaways.length === 0) {
    slides.push({
      type: "summary",
      headline: "Selected insights",
      items: selected.map((r) => r.title).slice(0, 5),
    });
  }

  slides.push({ type: "closing", headline: "Questions and next steps" });

  return {
    id: "share-deck",
    _id: "share-deck",
    _creationTime: Date.now(),
    scopeLabel: args.studyTitle.trim() || "Research readout",
    slides,
    stats: {
      reached: 0,
      memberCount: 0,
      guestsReached: 0,
      completionRate: 0,
      openItems: 0,
      totalViews: 0,
      reactions: { true: 0, surprised: 0, pushback: 0 },
    },
    reels: selected.map((r) => ({
      id: r.id,
      title: r.title,
      viewers: 0,
      completionRate: 0,
      trueCount: 0,
      surprisedCount: 0,
      pushbackCount: 0,
      commentCount: 0,
      track: r.track ?? "",
    })),
  };
}
