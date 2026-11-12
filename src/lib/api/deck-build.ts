/**
 * Readout deck: what the AI is asked for, and what we accept back.
 *
 * The slide components and the PowerPoint export read specific fields
 * (`headline`, `items`, `stats`, `quotes`, `reelTitle`). The model is given a
 * schema with exactly those fields, and its answer is then checked against the
 * study's own scenes: a quote or a figure that does not appear in a published
 * scene is dropped, so the deck cannot say something the research didn't.
 */

export type DeckSlideType = "title" | "summary" | "finding" | "figures" | "voices" | "reactions" | "next_steps" | "closing";

export type BuiltSlide = {
  type: DeckSlideType;
  headline: string;
  body?: string;
  items?: string[];
  stats?: Array<{ num: string; label: string }>;
  quotes?: Array<{ text: string; by: string }>;
  reelTitle?: string;
};

export type SceneLike = { type?: string; text?: string; by?: string; num?: string; label?: string; sub?: string };
export type ReelLike = { title: string; track?: string | null; scenes?: SceneLike[] | null };

export type Evidence = {
  reels: Array<{ title: string; track: string; hook: string; takeaway: string; quotes: Array<{ text: string; by: string }>; stats: Array<{ num: string; label: string }> }>;
  quotes: Array<{ text: string; by: string }>;
  stats: Array<{ num: string; label: string }>;
};

const SLIDE_TYPES: DeckSlideType[] = ["title", "summary", "finding", "figures", "voices", "reactions", "next_steps", "closing"];

/** Scene text marks emphasis with *asterisks*; slides don't. */
function plain(value: unknown): string {
  return typeof value === "string" ? value.replace(/\*/g, "").replace(/\s+/g, " ").trim() : "";
}

function key(value: string): string {
  return value.toLowerCase().replace(/[“”"'‘’.,!?;:\-–—\s]+/g, " ").trim();
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function collectEvidence(reels: ReelLike[]): Evidence {
  const out: Evidence = { reels: [], quotes: [], stats: [] };
  for (const reel of reels) {
    const scenes = Array.isArray(reel.scenes) ? reel.scenes : [];
    const quotes = scenes
      .filter((s) => s.type === "quote" && plain(s.text))
      .map((s) => ({ text: plain(s.text), by: plain(s.by) || "Participant" }));
    const stats = scenes
      .filter((s) => s.type === "stat" && plain(s.num))
      .map((s) => ({ num: plain(s.num), label: plain(s.label) }));
    out.reels.push({
      title: plain(reel.title),
      track: plain(reel.track),
      hook: plain(scenes.find((s) => s.type === "hook")?.text),
      takeaway: plain(scenes.find((s) => s.type === "cta")?.text),
      quotes,
      stats,
    });
    out.quotes.push(...quotes);
    out.stats.push(...stats);
  }
  return out;
}

export function evidencePrompt(evidence: Evidence): string {
  return evidence.reels
    .map((reel, i) => {
      const lines = [`Scene ${i + 1}: "${reel.title}"${reel.track ? ` (${reel.track})` : ""}`];
      if (reel.hook) lines.push(`  Question it answers: ${reel.hook}`);
      for (const quote of reel.quotes) lines.push(`  Quote: "${quote.text}" (${quote.by})`);
      for (const stat of reel.stats) lines.push(`  Figure: ${stat.num} ${stat.label}`);
      if (reel.takeaway) lines.push(`  Takeaway: ${reel.takeaway}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export const DECK_SYSTEM = `You write a short research readout for people who were not in the sessions. You are given the published scenes of a study: each has a question, participant quotes, figures and a takeaway.

Write 7 to 10 slides in this order:
1. title: the study in one line. "body" says who it is for and what it covers.
2. summary: "items" holds 3 to 5 findings, one plain sentence each, most important first.
3. Three to five "finding" slides, one per finding. "headline" states the finding as a full sentence. Support it with one quote and up to two figures taken from the scenes. Set "reelTitle" to the title of the scene the evidence came from.
4. Optionally one "figures" slide (2 to 4 figures) or one "voices" slide (2 or 3 quotes) if strong evidence is left over.
5. reactions: only if people have reacted. "headline" says in one sentence how the team received the findings.
6. next_steps: "items" holds 3 to 5 recommendations, each starting with a verb and following from a finding.
7. closing: one line on what to do next.

Rules:
- Quotes must be copied exactly from the scenes, with the same speaker label. Never write a new quote.
- Figures must be copied exactly from the scenes. Never calculate or estimate a number.
- Write plainly. No marketing language, no exclamation marks.
- Call the save_deck tool.`;

const TEXT = { type: "string" } as const;
export const DECK_TOOL = {
  name: "save_deck",
  description: "Save the readout deck",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["slides"],
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "headline"],
          properties: {
            type: { type: "string", enum: SLIDE_TYPES },
            headline: TEXT,
            body: TEXT,
            items: { type: "array", items: TEXT },
            stats: {
              type: "array",
              items: { type: "object", additionalProperties: false, required: ["num", "label"], properties: { num: TEXT, label: TEXT } },
            },
            quotes: {
              type: "array",
              items: { type: "object", additionalProperties: false, required: ["text", "by"], properties: { text: TEXT, by: TEXT } },
            },
            reelTitle: TEXT,
          },
        },
      },
    },
  },
};

/**
 * Turns whatever the model returned into slides the UI can draw, and removes
 * any quote or figure that is not in the study's scenes.
 */
export function sanitizeDeck(raw: unknown, evidence: Evidence, opts: { scopeLabel: string; hasReactions: boolean }): BuiltSlide[] {
  const quoteByKey = new Map(evidence.quotes.map((q) => [key(q.text), q]));
  const statByNum = new Map(evidence.stats.map((s) => [key(s.num), s]));
  const reelTitles = new Map(evidence.reels.map((r) => [key(r.title), r.title]));
  const list = Array.isArray((raw as { slides?: unknown })?.slides) ? ((raw as { slides: unknown[] }).slides as Array<Record<string, unknown>>) : [];

  const slides: BuiltSlide[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const type = SLIDE_TYPES.find((t) => t === item.type);
    // Older prompts used "title" for the heading; accept it so a retry isn't wasted.
    const headline = clip(plain(item.headline) || plain(item.title), 160);
    if (!type || !headline) continue;
    if (type === "reactions" && !opts.hasReactions) continue;

    const slide: BuiltSlide = { type, headline };
    const body = plain(item.body);
    if (body) slide.body = clip(body, 280);

    if (Array.isArray(item.items)) {
      const items = item.items.map(plain).filter(Boolean).slice(0, 5).map((text) => clip(text, 180));
      if (items.length) slide.items = items;
    }
    if (Array.isArray(item.quotes)) {
      const quotes = (item.quotes as Array<Record<string, unknown>>)
        .map((q) => quoteByKey.get(key(plain(q?.text))))
        .filter((q): q is { text: string; by: string } => Boolean(q))
        .slice(0, type === "finding" ? 1 : 3);
      if (quotes.length) slide.quotes = quotes;
    }
    if (Array.isArray(item.stats)) {
      const stats = (item.stats as Array<Record<string, unknown>>)
        .map((s) => {
          const known = statByNum.get(key(plain(s?.num)));
          return known ? { num: known.num, label: clip(plain(s?.label) || known.label, 90) } : null;
        })
        .filter((s): s is { num: string; label: string } => Boolean(s))
        .slice(0, type === "finding" ? 2 : 4);
      if (stats.length) slide.stats = stats;
    }
    const reelTitle = reelTitles.get(key(plain(item.reelTitle)));
    if (reelTitle) slide.reelTitle = reelTitle;

    // A list slide with no list, or an evidence slide with no evidence left, has nothing to show.
    if ((type === "summary" || type === "next_steps") && !slide.items) continue;
    if (type === "figures" && !slide.stats) continue;
    if (type === "voices" && !slide.quotes) continue;
    if (type === "finding" && !slide.stats && !slide.quotes && !slide.body) continue;
    slides.push(slide);
  }

  const middle = slides.filter((s) => s.type !== "title" && s.type !== "closing");
  if (!middle.some((s) => s.type === "finding" || s.type === "summary")) {
    throw new Error("The deck came back without any findings. Try again.");
  }
  const title = slides.find((s) => s.type === "title") ?? { type: "title" as const, headline: opts.scopeLabel, body: "Research readout" };
  const closing = slides.find((s) => s.type === "closing") ?? { type: "closing" as const, headline: "Questions and next steps" };
  return [title, ...middle.slice(0, 13), closing];
}
