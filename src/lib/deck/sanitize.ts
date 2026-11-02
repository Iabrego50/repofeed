import { z } from "zod";

export const SLIDE_TYPES = [
  "title",
  "summary",
  "finding",
  "figures",
  "voices",
  "reactions",
  "next_steps",
  "closing",
] as const;
export type SlideType = (typeof SLIDE_TYPES)[number];

const SINGLE_USE: ReadonlySet<SlideType> = new Set([
  "title",
  "summary",
  "figures",
  "voices",
  "reactions",
  "next_steps",
  "closing",
]);
const MAX_FINDING_SLIDES = 5;

export type DeckQuote = { text: string; by: string };
export type DeckStat = { num: string; label: string };
export type DeckSlide = {
  type: SlideType;
  headline: string;
  body: string;
  reelTitle?: string;
  quotes?: DeckQuote[];
  items?: string[];
  stats?: DeckStat[];
};

export type DeckComment = {
  body: string;
  by: string;
  kind: string;
  reel: string;
};
export type DeckFinding = {
  type: string;
  text: string;
  speaker?: string;
  number?: string;
  label?: string;
};

export const deckSchema = z.object({
  slides: z.array(
    z.object({
      type: z.enum(SLIDE_TYPES),
      headline: z.string(),
      body: z.string().nullish(),
      reelTitle: z.string().nullish(),
      quotes: z
        .array(z.object({ text: z.string(), by: z.string() }))
        .nullish(),
      stats: z
        .array(z.object({ num: z.string(), label: z.string() }))
        .nullish(),
      items: z.array(z.string()).nullish(),
    })
  ),
});
export type RawDeck = z.infer<typeof deckSchema>;

const norm = (s: string) =>
  s
    .replace(/[\u201C\u201D"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const cleanList = (items: string[] | null | undefined, max: number) =>
  (items ?? [])
    .map((i) => i.trim())
    .filter(Boolean)
    .slice(0, max);

type SanitizeCtx = {
  reelTitles: string[];
  comments: DeckComment[];
  findings: DeckFinding[];
  fallbackTitle: string;
};

function evidence(ctx: SanitizeCtx) {
  const numbers = new Map<string, DeckFinding>();
  for (const f of ctx.findings)
    if (f.number && !numbers.has(norm(f.number)))
      numbers.set(norm(f.number), f);

  const quoteFindings = ctx.findings.filter((f) => f.type === "quote");
  const comments = new Map(ctx.comments.map((c) => [norm(c.body), c]));

  const stat = (s: DeckStat): DeckStat | undefined => {
    const f = numbers.get(norm(s.num));
    if (!f?.number) return undefined;
    const label = (s.label.trim() || f.label || "").slice(0, 80);
    return label ? { num: f.number, label } : undefined;
  };

  const participantQuote = (q: DeckQuote): DeckQuote | undefined => {
    const t = norm(q.text);
    if (t.length < 12) return undefined;
    const f = quoteFindings.find((x) => norm(x.text).includes(t));
    return f
      ? {
          text: q.text.trim().replace(/^["\u201C]|["\u201D]$/g, ""),
          by: f.speaker ?? "Participant",
        }
      : undefined;
  };

  const teamQuote = (q: DeckQuote): DeckQuote | undefined => {
    const c = comments.get(norm(q.text));
    return c ? { text: c.body, by: c.by } : undefined;
  };

  return {
    stat,
    participantQuote,
    teamQuote,
    hasParticipantQuotes: quoteFindings.length > 0,
  };
}

const defined = <T>(x: T | undefined): x is T => x !== undefined;

export function sanitizeDeck(raw: RawDeck, ctx: SanitizeCtx): DeckSlide[] {
  const titles = new Map(ctx.reelTitles.map((t) => [norm(t), t]));
  const ev = evidence(ctx);
  const seen = new Set<SlideType>();
  let findingSlides = 0;
  const out: DeckSlide[] = [];

  for (const s of raw.slides) {
    const headline = s.headline.trim();
    if (!headline) continue;
    if (SINGLE_USE.has(s.type) && seen.has(s.type)) continue;

    const slide: DeckSlide = {
      type: s.type,
      headline,
      body: s.body?.trim() ?? "",
    };

    if (s.type === "summary" || s.type === "next_steps") {
      const items = cleanList(s.items, 4);
      if (items.length === 0) continue;
      slide.items = items;
    }

    if (s.type === "figures") {
      const stats = (s.stats ?? [])
        .map(ev.stat)
        .filter(defined)
        .slice(0, 4);
      if (stats.length < 2) continue;
      slide.stats = stats;
    }

    if (s.type === "voices") {
      const pick = ev.hasParticipantQuotes
        ? ev.participantQuote
        : ev.teamQuote;
      const quotes = (s.quotes ?? [])
        .map(pick)
        .filter(defined)
        .slice(0, 3);
      if (quotes.length === 0) continue;
      slide.quotes = quotes;
    }

    if (s.type === "finding") {
      if (findingSlides >= MAX_FINDING_SLIDES) continue;
      findingSlides++;
      const stats = (s.stats ?? [])
        .map(ev.stat)
        .filter(defined)
        .slice(0, 2);
      const quotes = (s.quotes ?? [])
        .map(ev.participantQuote)
        .filter(defined)
        .slice(0, 1);
      const reel = s.reelTitle ? titles.get(norm(s.reelTitle)) : undefined;
      if (stats.length) slide.stats = stats;
      if (quotes.length) slide.quotes = quotes;
      if (reel) slide.reelTitle = reel;
    }

    seen.add(s.type);
    out.push(slide);
  }

  if (out[0]?.type !== "title") {
    const idx = out.findIndex((s) => s.type === "title");
    const title =
      idx >= 0
        ? out.splice(idx, 1)[0]
        : { type: "title" as const, headline: ctx.fallbackTitle, body: "" };
    out.unshift(title);
  }

  return out;
}
