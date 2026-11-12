/**
 * Finding insights across a workspace: by topic, by keyword, or by asking a
 * question in plain words.
 *
 * Everything here is pure, so the same ranking runs in the browser (instant
 * results while typing), on the server (choosing what the AI gets to read),
 * and in tests. The AI parts are only the prompt, the tool schema, and the
 * checks applied to what comes back.
 */
import type { Scene } from "@/schema/validators.ts";

export type LibraryInsight = {
  id: string;
  title: string;
  track: string;
  studyTitle: string;
  topics: string[];
  scenes: Scene[];
};

export type RankedInsight<T extends LibraryInsight = LibraryInsight> = {
  insight: T;
  score: number;
  /** A piece of the scene text around the best match, for showing why it matched. */
  snippet: string | null;
};

// ---------------------------------------------------------------------------
// Text helpers

const STOPWORDS = new Set(
  "a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its just me more most my no not of on or our out so some than that the their them then there these they this those to too us was we were what when where which who why will with would you your about after again all any because before being both each few further here him his her own same she should such through under until up very while whom over also get got make made people person thing things really lot".split(
    " ",
  ),
);

/** Lowercase words without punctuation or emphasis markers. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[‘’]/g, "'")
    .split(/[^\p{L}\p{N}%'-]+/u)
    .map((w) => w.replace(/^['-]+|['-]+$/g, "").replace(/'s$/, ""))
    .filter(Boolean);
}

/**
 * A light stemmer so "cancelled", "cancels" and "cancelling" meet at "cancel".
 * It only trims common English endings; it is not meant to be linguistically exact.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3 || /\d/.test(w)) return w;
  for (const [end, keep] of [
    ["ations", ""],
    ["ation", ""],
    ["ies", "y"],
    ["ied", "y"],
    ["ing", ""],
    ["ed", ""],
    ["ly", ""],
    ["es", ""],
    ["s", ""],
  ] as const) {
    // "boxes" -> "box", but "prices" -> "price" (only drop "es" after s, x, z, ch, sh).
    if (end === "es" && !/(s|x|z|ch|sh)es$/.test(w)) continue;
    if (end === "s" && /(ss|us|is)$/.test(w)) continue;
    if (w.endsWith(end) && w.length - end.length >= 3) {
      w = w.slice(0, w.length - end.length) + keep;
      break;
    }
  }
  // "cancell" -> "cancel", "stopp" -> "stop"
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss)$/.test(word)) w = w.slice(0, -1);
  if (w.endsWith("ll") && w.length > 4) w = w.slice(0, -1);
  return w;
}

export function terms(text: string): string[] {
  return words(text)
    .filter((w) => !STOPWORDS.has(w))
    .map(stem);
}

/** All readable text in a scene list, without the emphasis markers. */
export function sceneText(scenes: Scene[]): string {
  return scenes
    .map((s) => {
      switch (s.type) {
        case "hook":
          return s.text;
        case "cta":
          return `${s.text} ${s.sub ?? ""}`;
        case "line":
          return s.kicker ? `${s.kicker} ${s.text}` : s.text;
        case "list":
          return `${s.title} ${(s.items || []).join(" ")}`;
        case "stat":
          return `${s.num} ${s.label}`;
        case "quote":
          return `${s.text} ${s.by}`;
        default:
          return "";
      }
    })
    .join(" ")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Topics

/** "  Cancellation Flow " -> "cancellation flow". Topics are stored lowercase and shown in sentence case. */
export function normalizeTopic(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .toLowerCase()
    .replace(/[#*_"“”]/g, "")
    .replace(/[^\p{L}\p{N}\s&'/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > 32) return "";
  return cleaned.split(" ").length > 3 ? "" : cleaned;
}

export function topicLabel(topic: string): string {
  return topic ? topic.charAt(0).toUpperCase() + topic.slice(1) : topic;
}

/** Up to four distinct, tidy topics. */
export function cleanTopics(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.map(normalizeTopic).filter(Boolean))].slice(0, 4);
}

/** Every topic in use with how many insights carry it, most used first. */
export function topicCounts(insights: Array<Pick<LibraryInsight, "topics">>): Array<{ topic: string; count: number }> {
  const counts = new Map<string, number>();
  for (const insight of insights) for (const topic of insight.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

// ---------------------------------------------------------------------------
// Ranking

const SNIPPET_RADIUS = 60;

function snippetFor(text: string, queryTerms: string[]): string | null {
  if (!text || queryTerms.length === 0) return null;
  const lower = text.toLowerCase();
  let best = -1;
  for (const term of queryTerms) {
    const at = lower.search(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    if (at >= 0 && (best < 0 || at < best)) best = at;
  }
  if (best < 0) return null;
  const start = Math.max(0, best - SNIPPET_RADIUS);
  const end = Math.min(text.length, best + SNIPPET_RADIUS * 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Scores every insight against a query, BM25-style: rare words count for more,
 * and a match in a topic or the title counts for more than one in the body.
 * Partial matches are kept, so a question phrased in other words still finds
 * insights that share some of its terms.
 */
export function rankInsights<T extends LibraryInsight>(insights: T[], query: string, limit = 50): RankedInsight<T>[] {
  const queryTerms = [...new Set(terms(query))];
  if (queryTerms.length === 0) return [];

  const docs = insights.map((insight) => {
    const body = sceneText(insight.scenes);
    const fields = {
      topics: terms(insight.topics.join(" ")),
      title: terms(insight.title),
      body: terms(body),
      meta: terms(`${insight.track} ${insight.studyTitle}`),
    };
    return { insight, body, fields, length: fields.body.length + fields.title.length };
  });
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const term of queryTerms) {
    df.set(term, docs.filter((d) => Object.values(d.fields).some((f) => f.includes(term))).length);
  }

  const k1 = 1.2;
  const b = 0.75;
  const weights = { topics: 3, title: 2, body: 1, meta: 0.5 } as const;
  const ranked: RankedInsight<T>[] = [];
  for (const doc of docs) {
    let score = 0;
    let matched = 0;
    for (const term of queryTerms) {
      const n = df.get(term) ?? 0;
      if (n === 0) continue;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      let tf = 0;
      for (const [field, weight] of Object.entries(weights) as Array<[keyof typeof weights, number]>) {
        tf += doc.fields[field].filter((t) => t === term).length * weight;
      }
      if (tf === 0) continue;
      matched += 1;
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / Math.max(1, avgLength))));
    }
    if (matched === 0) continue;
    // Reward covering more of the question, so "why do people cancel after the trial"
    // prefers an insight about both over one about either.
    score *= 0.5 + 0.5 * (matched / queryTerms.length);
    const rawWords = words(query).filter((w) => !STOPWORDS.has(w));
    ranked.push({ insight: doc.insight, score, snippet: snippetFor(doc.body, rawWords.length ? rawWords : queryTerms) });
  }
  return ranked.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** Insights carrying every one of the given topics. */
export function withTopics<T extends LibraryInsight>(insights: T[], topics: string[]): T[] {
  if (topics.length === 0) return insights;
  return insights.filter((insight) => topics.every((topic) => insight.topics.includes(topic)));
}

// ---------------------------------------------------------------------------
// Asking a question (server side)

/** At or under this many insights, the AI reads all of them; above it, the best matches by keyword. */
export const ASK_FULL_READ_LIMIT = 150;
export const ASK_MAX_RESULTS = 8;

/** A compact, citation-ready description of one insight for the model. */
export function insightBrief(insight: LibraryInsight): string {
  const parts: string[] = [];
  for (const scene of insight.scenes) {
    if (scene.type === "hook") parts.push(`Question: ${scene.text}`);
    else if (scene.type === "quote") parts.push(`Quote: "${scene.text}" (${scene.by})`);
    else if (scene.type === "stat") parts.push(`Figure: ${scene.num} ${scene.label}`);
    else if (scene.type === "line") parts.push(scene.text ?? "");
    else if (scene.type === "list") parts.push(`${scene.title}: ${(scene.items || []).join("; ")}`);
    else if (scene.type === "cta") parts.push(`Takeaway: ${scene.text}`);
  }
  const text = parts.join(" | ").replace(/\*/g, "");
  return `${insight.title} [study: ${insight.studyTitle}${insight.topics.length ? `; topics: ${insight.topics.join(", ")}` : ""}] ${text.slice(0, 700)}`;
}

/** Which insights the model gets to read for a question. */
export function askCandidates<T extends LibraryInsight>(insights: T[], question: string): T[] {
  if (insights.length <= ASK_FULL_READ_LIMIT) return insights;
  const ranked = rankInsights(insights, question, ASK_FULL_READ_LIMIT).map((r) => r.insight);
  // Pad with the newest insights so a question that shares no words still gets something to read.
  const seen = new Set(ranked.map((r) => r.id));
  for (const insight of insights) {
    if (ranked.length >= ASK_FULL_READ_LIMIT) break;
    if (!seen.has(insight.id)) ranked.push(insight);
  }
  return ranked;
}

export function askPrompt(question: string, candidates: LibraryInsight[]): string {
  return `Question: ${question.trim().slice(0, 500)}

Insights you may cite (id: description):
${candidates.map((c) => `${c.id}: ${insightBrief(c)}`).join("\n")}`;
}

export const ASK_SYSTEM = `You help people find what their research already says. You are given a question and a list of insights from published research studies. Each insight has an id, a title, the study it came from, its topics, and its quotes, figures and takeaway.

1. Pick the insights that help answer the question, most useful first, at most ${ASK_MAX_RESULTS}. Pick none if nothing applies.
2. For each, write "why": one short sentence on what it adds to the answer.
3. Write "answer": two to four plain sentences that answer the question using only the picked insights. After each claim, cite the insight by its position in your list, like [1] or [2][3].

Rules:
- Use only what the insights say. Do not add causes, numbers or advice they don't contain.
- If the insights only partly answer the question, say what they do cover and what they don't.
- If nothing applies, return an empty list and an answer saying the research doesn't cover this yet.
- Copy figures exactly. Write plainly, no marketing language.
Call the answer_question tool.`;

export const ASK_TOOL = {
  name: "answer_question",
  description: "Return the insights that answer the question, and a short cited answer",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "insights"],
    properties: {
      answer: { type: "string" },
      insights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "why"],
          properties: { id: { type: "string" }, why: { type: "string" } },
        },
      },
    },
  },
};

export type AskResult = {
  /** "ai": written answer from the model. "keyword": closest matches only, no written answer. */
  mode: "ai" | "keyword";
  answer: string | null;
  insights: Array<{ id: string; why: string | null }>;
  /** How many insights were searched. */
  searched: number;
};

/**
 * Keeps only insights that exist in this workspace, then renumbers the [n]
 * citations to match. A citation to an insight that was dropped is removed,
 * so the answer can never point at something the reader can't open.
 */
export function sanitizeAnswer(raw: unknown, candidateIds: Set<string>, searched: number): AskResult {
  const value = (raw ?? {}) as { answer?: unknown; insights?: unknown };
  const listed = Array.isArray(value.insights) ? (value.insights as Array<{ id?: unknown; why?: unknown }>) : [];
  const kept: Array<{ id: string; why: string | null }> = [];
  const renumber = new Map<number, number>();
  listed.forEach((item, index) => {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!candidateIds.has(id) || kept.some((k) => k.id === id) || kept.length >= ASK_MAX_RESULTS) return;
    kept.push({ id, why: typeof item.why === "string" && item.why.trim() ? item.why.trim().slice(0, 240) : null });
    renumber.set(index + 1, kept.length);
  });
  let answer = typeof value.answer === "string" ? value.answer.trim().slice(0, 1200) : "";
  answer = answer
    .replace(/\[(\d+)\]/g, (_, n: string) => {
      const to = renumber.get(Number(n));
      return to ? `[${to}]` : "";
    })
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { mode: "ai", answer: answer || null, insights: kept, searched };
}

/** What a reader gets when the AI is unavailable: the closest matches by keyword, no written answer. */
export function keywordAnswer(insights: LibraryInsight[], question: string): AskResult {
  return {
    mode: "keyword",
    answer: null,
    insights: rankInsights(insights, question, ASK_MAX_RESULTS).map((r) => ({ id: r.insight.id, why: null })),
    searched: insights.length,
  };
}

/** Splits "Price leads [1][2], then volume [3]." into text and citation parts for rendering. */
export function citationParts(answer: string): Array<{ text: string } | { cite: number }> {
  const parts: Array<{ text: string } | { cite: number }> = [];
  let last = 0;
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    if (match.index! > last) parts.push({ text: answer.slice(last, match.index) });
    parts.push({ cite: Number(match[1]) });
    last = match.index! + match[0].length;
  }
  if (last < answer.length) parts.push({ text: answer.slice(last) });
  return parts;
}

// ---------------------------------------------------------------------------
// Tagging insights with topics (server side)

export const TOPIC_SYSTEM = `You tag research insights with topics so people can browse them. For each insight, give 2 to 4 topics.

- A topic is a short noun phrase of 1 to 3 words naming what the insight is about: a product area, a behaviour, a need or a pain point. Examples: "pricing", "cancellation flow", "meal planning", "food waste", "onboarding", "trust".
- Use lowercase. No study names, no participant names, no sentiment words like "positive".
- Reuse the same wording for the same idea across insights. Prefer topics from the existing list when they fit.
Call the save_topics tool.`;

export const TOPIC_TOOL = {
  name: "save_topics",
  description: "Save the topics for each insight",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["insights"],
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "topics"],
          properties: { id: { type: "string" }, topics: { type: "array", items: { type: "string" } } },
        },
      },
    },
  },
};

export function topicPrompt(insights: LibraryInsight[], existing: string[]): string {
  return `${existing.length ? `Existing topics in this workspace: ${existing.slice(0, 80).join(", ")}\n\n` : ""}Insights (id: description):
${insights.map((i) => `${i.id}: ${insightBrief({ ...i, topics: [] })}`).join("\n")}`;
}

export function sanitizeTopics(raw: unknown, ids: Set<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const list = Array.isArray((raw as { insights?: unknown })?.insights) ? ((raw as { insights: unknown[] }).insights as Array<{ id?: unknown; topics?: unknown }>) : [];
  for (const item of list) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!ids.has(id) || out.has(id)) continue;
    const topics = cleanTopics(item.topics);
    if (topics.length) out.set(id, topics);
  }
  return out;
}
