// @ts-nocheck
import type { Doc } from "@/convex/_generated/dataModel";

export type Deck = Doc<"decks">;
export type DeckSlide = Deck["slides"][number];
export type DeckReel = Deck["reels"][number];

/** Slides are designed on a fixed canvas and scaled to fit, so charts and type stay in proportion. */
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export const COLORS = {
  bg: "#070B14",
  card: "#0E1422",
  border: "#1F2A40",
  fg: "#EEF3FB",
  muted: "#93A0B8",
  coral: "#2F9BFF",
  green: "#3FE0A0",
  amber: "#FFC23D",
  red: "#FF5A5F",
} as const;

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const KICKERS: Record<DeckSlide["type"], string> = {
  title: "Research readout",
  summary: "What we learned",
  finding: "Finding",
  figures: "By the numbers",
  voices: "In their words",
  reactions: "How the team received it",
  next_steps: "What we recommend",
  closing: "Thank you",
  numbers: "At a glance",
  reach: "Who watched what",
  completion: "Did people finish",
  spotlight: "Worth a closer look",
};

const LEGACY_TYPES = new Set<DeckSlide["type"]>(["numbers", "reach", "completion", "spotlight"]);

/** Decks made before the outcome-led rewrite are about engagement, not findings. */
export function isLegacyDeck(deck: Deck): boolean {
  return deck.slides.some((s) => LEGACY_TYPES.has(s.type)) || !deck.slides.some((s) => s.type === "finding" || s.type === "summary");
}

/** "Finding 2 of 4" style kicker, so the outcome slides read as a sequence. */
export function kickerFor(deck: Deck, index: number): string {
  const slide = deck.slides[index];
  if (slide?.type !== "finding") return KICKERS[slide?.type ?? "title"];
  const findings = deck.slides.filter((s) => s.type === "finding");
  const n = deck.slides.slice(0, index + 1).filter((s) => s.type === "finding").length;
  return `Finding ${n} of ${findings.length}`;
}

/** Ranked by people reached, not plays, so one enthusiast can't top the chart. */
export function topByViews(reels: DeckReel[], n = 8): DeckReel[] {
  return [...reels].sort((a, b) => b.viewers - a.viewers).slice(0, n);
}

/** Completion only means something for reels people actually opened. */
export function topByCompletion(reels: DeckReel[], n = 8): DeckReel[] {
  return [...reels].filter((r) => r.viewers > 0).sort((a, b) => b.viewers - a.viewers).slice(0, n);
}

export function reactionData(deck: Deck) {
  const r = deck.stats.reactions;
  return [
    { name: "Rings true", value: r.true, color: COLORS.green },
    { name: "Surprised me", value: r.surprised, color: COLORS.amber },
    { name: "Push back", value: r.pushback, color: COLORS.red },
  ];
}

export function headlineStats(deck: Deck) {
  const s = deck.stats;
  return [
    { label: "People reached", value: `${s.reached} / ${s.memberCount}`, sub: s.guestsReached ? `plus ${s.guestsReached} guests` : "workspace members" },
    { label: "Finished", value: pct(s.completionRate), sub: "of viewers watched to the end" },
    { label: "Open items", value: String(s.openItems), sub: "questions and actions" },
    { label: "Total plays", value: s.totalViews.toLocaleString(), sub: "max one per person a day" },
  ];
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function deckFileName(deck: Deck): string {
  return `repofeed-readout-${deck.scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
