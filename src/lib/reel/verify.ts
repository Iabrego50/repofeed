import type { Scene } from "@/schema";

/** Lowercase, unify quotes/dashes, strip punctuation except % . ' - and collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[^\p{L}\p{N}\s%.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type QuoteResult = "ok" | "close" | "missing";

const stripWord = (w: string) => w.replace(/^[.'-]+|[.'-]+$/g, "");

export type SourceIndex = {
  normalized: string;
  words: string[];
  positions: Map<string, number[]>;
};

export function buildSourceIndex(text: string): SourceIndex {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").map(stripWord);
  const positions = new Map<string, number[]>();
  words.forEach((w, i) => {
    const list = positions.get(w);
    if (list) list.push(i);
    else positions.set(w, [i]);
  });
  return { normalized, words, positions };
}

/** A quote passes only if it appears verbatim (after normalization). */
export function verifyQuote(quote: string, source: SourceIndex): QuoteResult {
  const nq = normalizeText(quote).replace(/[.\s]+$/, "");
  if (!nq) return "missing";
  if (source.normalized.includes(nq)) return "ok";

  // "Close": some window of source words matches at least 80% of the quote words.
  const qw = nq.split(" ").map(stripWord);
  const starts = new Set<number>();
  for (let k = 0; k < Math.min(4, qw.length); k++) {
    for (const p of source.positions.get(qw[k]) ?? []) starts.add(p - k);
  }
  let best = 0;
  for (const s of starts) {
    let hits = 0;
    for (let m = 0; m < qw.length; m++) {
      if (source.words[s + m] === qw[m]) hits++;
    }
    best = Math.max(best, hits / qw.length);
  }
  return best >= 0.75 && qw.length >= 3 ? "close" : "missing";
}

/** Every digit group in the number must appear in the source as a standalone number. */
export function verifyNumber(num: string, source: SourceIndex): string | null {
  const groups = normalizeText(num).match(/\d+(?:\.\d+)*/g) ?? [];
  for (const g of groups) {
    const escaped = g.replace(/\./g, "\\.");
    const re = new RegExp(`(^|[^\\d.])${escaped}(?![\\d]|\\.\\d)`);
    if (!re.test(source.normalized)) return g;
  }
  return null;
}

const snippet = (text: string) => {
  const words = text.trim().split(/\s+/);
  return words.length > 8 ? `${words.slice(0, 8).join(" ")}…` : words.join(" ");
};

export const WARNINGS = {
  quoteMissing: (q: string) => `Quote not found in your files: "${snippet(q)}"`,
  quoteClose: (q: string) => `Quote is close to your files but not word-for-word: "${snippet(q)}"`,
  number: (n: string) => `Number "${n}" not found in your files`,
} as const;

/** Returns the first verification warning for a reel, or null if it passes. */
export function verifyScenes(
  scenes: Scene[],
  source: SourceIndex,
): string | null {
  for (const scene of scenes) {
    if (scene.type === "quote") {
      const r = verifyQuote(scene.text, source);
      if (r === "close") return WARNINGS.quoteClose(scene.text);
      if (r === "missing") return WARNINGS.quoteMissing(scene.text);
    }
    if (scene.type === "stat") {
      const missing = verifyNumber(scene.num, source);
      if (missing) return WARNINGS.number(scene.num);
    }
  }
  return null;
}
