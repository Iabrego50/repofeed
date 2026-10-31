import { z } from "zod";

/**
 * Outcome-led slide types come first. The engagement types (numbers, reach, completion,
 * spotlight) are kept so older decks still render, but new decks don't use them.
 */
export const SLIDE_TYPES = [
  "title",
  "summary",
  "finding",
  "figures",
  "voices",
  "reactions",
  "next_steps",
  "closing",
  "numbers",
  "reach",
  "completion",
  "spotlight",
] as const;
export type SlideType = (typeof SLIDE_TYPES)[number];

/** Types the model may use for new decks. */
const ALLOWED: ReadonlySet<SlideType> = new Set(["title", "summary", "finding", "figures", "voices", "reactions", "next_steps", "closing"]);
/** Slide types that can appear at most once. */
const SINGLE_USE: ReadonlySet<SlideType> = new Set(["title", "summary", "figures", "voices", "reactions", "next_steps", "closing"]);
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

export type DeckComment = { body: string; by: string; kind: string; reel: string };
/** A finding extracted from the study's sources. */
export type DeckFinding = { type: string; text: string; speaker?: string; number?: string; label?: string; study?: string };

export const DECK_SYSTEM = `You are a research lead writing a stakeholder readout of what a research study FOUND. The audience wants the outcomes: what we learned about the people studied, how strong the evidence is, and what we should do about it.

This deck is about the research, not about the tool it was shared in. Never talk about "reels", views, completion rates, the feed, dashboards or how many teammates watched. The only exception is the optional "reactions" slide, which says in one line how the team received the findings.

Voice: a thoughtful researcher talking to colleagues. Plain, specific, warm and direct. No buzzwords ("leverage", "unlock", "delve", "game-changer", "robust"), no hype, no exclamation marks, no emojis.

Headlines state the outcome as a sentence (at most 12 words), e.g. "People cancel when planning meals starts to feel like work". Never a label like "Findings". Body text is 1-2 short sentences (at most 35 words) on what it means for the team.

Slide types (use 8-11 slides):
- title: headline = deck title naming what the study learned, body = one-line subtitle (who was studied, how).
- summary: items = the 3-4 most important outcomes, each a plain sentence of at most 14 words.
- finding: one key outcome per slide (use 3-5). Back it with evidence from the findings list:
  - stats: optional, at most 2 figures {num, label}. "num" must be copied EXACTLY from a finding's number.
  - quotes: optional, 1 participant quote {text, by}. "text" must be copied EXACTLY (a verbatim passage) from a [quote] finding, "by" is its speaker.
  - reelTitle: optional, copied EXACTLY from the reel list, the reel that covers this finding (its team reactions are shown small).
- figures: 2-4 headline figures from the research {num, label}, num copied EXACTLY from findings. Skip if there are fewer than 2 numbers.
- voices: 1-3 participant quotes copied EXACTLY from [quote] findings. Team comments may be used only if there are no participant quotes.
- reactions: optional and at most once, near the end: how the team received the findings (chart is drawn for you). Skip if nobody has reacted.
- next_steps: items = 2-4 concrete recommendations (each at most 12 words), grounded in the findings, especially [recommendation] findings.
- closing: headline = a short closing thought, body = optional.

Rules:
- Order: title, summary, finding slides (strongest first), figures/voices where they fit the story, reactions (optional), next_steps, closing.
- Only use numbers, quotes and people that appear in the findings, written exactly as given. Never invent figures, quotes, people or causes. Be honest about weak or single-source evidence.
Call the save_deck tool with your result.`;

const statSchema = { type: "object", properties: { num: { type: "string" }, label: { type: "string" } }, required: ["num", "label"] };
const quoteSchema = { type: "object", properties: { text: { type: "string" }, by: { type: "string" } }, required: ["text", "by"] };

export const DECK_TOOL = {
  name: "save_deck",
  description: "Save the slide deck",
  parameters: {
    type: "object",
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...ALLOWED] },
            headline: { type: "string" },
            body: { type: "string" },
            reelTitle: { type: "string" },
            quotes: { type: "array", items: quoteSchema },
            stats: { type: "array", items: statSchema },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["type", "headline"],
        },
      },
    },
    required: ["slides"],
  },
};

export const deckSchema = z.object({
  slides: z.array(
    z.object({
      type: z.enum(SLIDE_TYPES),
      headline: z.string(),
      body: z.string().nullish(),
      reelTitle: z.string().nullish(),
      quotes: z.array(z.object({ text: z.string(), by: z.string() })).nullish(),
      stats: z.array(z.object({ num: z.string(), label: z.string() })).nullish(),
      items: z.array(z.string()).nullish(),
    }),
  ),
});
export type RawDeck = z.infer<typeof deckSchema>;

const norm = (s: string) => s.replace(/[\u201C\u201D"]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const cleanList = (items: string[] | null | undefined, max: number) => (items ?? []).map((i) => i.trim()).filter(Boolean).slice(0, max);

type SanitizeCtx = { reelTitles: string[]; comments: DeckComment[]; findings: DeckFinding[]; fallbackTitle: string };

/** Looks up evidence the model cites, so every number and quote on a slide traces back to the sources. */
function evidence(ctx: SanitizeCtx) {
  const numbers = new Map<string, DeckFinding>();
  for (const f of ctx.findings) if (f.number && !numbers.has(norm(f.number))) numbers.set(norm(f.number), f);
  const quoteFindings = ctx.findings.filter((f) => f.type === "quote");
  const comments = new Map(ctx.comments.map((c) => [norm(c.body), c]));

  const stat = (s: DeckStat): DeckStat | undefined => {
    const f = numbers.get(norm(s.num));
    if (!f?.number) return undefined;
    const label = (s.label.trim() || f.label || "").slice(0, 80);
    return label ? { num: f.number, label } : undefined;
  };
  // Participant quotes may be a verbatim excerpt of a longer quote finding.
  const participantQuote = (q: DeckQuote): DeckQuote | undefined => {
    const t = norm(q.text);
    if (t.length < 12) return undefined;
    const f = quoteFindings.find((x) => norm(x.text).includes(t));
    return f ? { text: q.text.trim().replace(/^["\u201C]|["\u201D]$/g, ""), by: f.speaker ?? "Participant" } : undefined;
  };
  const teamQuote = (q: DeckQuote): DeckQuote | undefined => {
    const c = comments.get(norm(q.text));
    // Use the stored comment and author, not the model's copy.
    return c ? { text: c.body, by: c.by } : undefined;
  };
  return { stat, participantQuote, teamQuote, hasParticipantQuotes: quoteFindings.length > 0 };
}

const defined = <T>(x: T | undefined): x is T => x !== undefined;

/**
 * Keeps only slides the app can back with real data: numbers and quotes must come from
 * the study's findings (or real comments), reels must exist, and single-use slides appear once.
 */
export function sanitizeDeck(raw: RawDeck, ctx: SanitizeCtx): DeckSlide[] {
  const titles = new Map(ctx.reelTitles.map((t) => [norm(t), t]));
  const ev = evidence(ctx);
  const seen = new Set<SlideType>();
  let findingSlides = 0;
  const out: DeckSlide[] = [];

  for (const s of raw.slides) {
    const headline = s.headline.trim();
    if (!headline || !ALLOWED.has(s.type)) continue;
    if (SINGLE_USE.has(s.type) && seen.has(s.type)) continue;
    const slide: DeckSlide = { type: s.type, headline, body: s.body?.trim() ?? "" };

    if (s.type === "summary" || s.type === "next_steps") {
      const items = cleanList(s.items, 4);
      if (items.length === 0) continue;
      slide.items = items;
    }
    if (s.type === "figures") {
      const stats = (s.stats ?? []).map(ev.stat).filter(defined).slice(0, 4);
      if (stats.length < 2) continue;
      slide.stats = stats;
    }
    if (s.type === "voices") {
      const pick = ev.hasParticipantQuotes ? ev.participantQuote : ev.teamQuote;
      const quotes = (s.quotes ?? []).map(pick).filter(defined).slice(0, 3);
      if (quotes.length === 0) continue;
      slide.quotes = quotes;
    }
    if (s.type === "finding") {
      if (findingSlides >= MAX_FINDING_SLIDES) continue;
      findingSlides++;
      const stats = (s.stats ?? []).map(ev.stat).filter(defined).slice(0, 2);
      const quotes = (s.quotes ?? []).map(ev.participantQuote).filter(defined).slice(0, 1);
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
    const title = idx >= 0 ? out.splice(idx, 1)[0] : { type: "title" as const, headline: ctx.fallbackTitle, body: "" };
    out.unshift(title);
  }
  return out;
}
