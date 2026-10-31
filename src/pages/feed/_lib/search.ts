import type { Scene } from "@/schema/validators.ts";

export type SearchableReel = {
  _id: string;
  title: string;
  track: string;
  studyTitle: string;
  scenes: Scene[];
};

export type SearchHit<T extends SearchableReel> = {
  reel: T;
  /** A short piece of the scene text around the first match, when the match isn't in the title. */
  snippet: string | null;
};

const SNIPPET_RADIUS = 48;

/** All readable text of a reel's scenes, without the emphasis markers. */
export function sceneText(scenes: Scene[]): string {
  return scenes
    .map((s) => {
      switch (s.type) {
        case "hook":
          return s.text;
        case "cta":
          return `${s.text} ${s.sub}`;
        case "line":
          return s.kicker ? `${s.kicker} ${s.text}` : s.text;
        case "list":
          return `${s.title} ${s.items.join(" ")}`;
        case "stat":
          return `${s.num} ${s.label}`;
        case "quote":
          return `${s.text} ${s.by}`;
      }
    })
    .join(" ")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function snippetAround(text: string, word: string): string | null {
  const i = text.toLowerCase().indexOf(word);
  if (i < 0) return null;
  const start = Math.max(0, i - SNIPPET_RADIUS);
  const end = Math.min(text.length, i + word.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Matches reels where every word of the query appears in the title, scene text,
 * category or study name. Title matches rank first. `track` narrows to one category.
 */
export function searchReels<T extends SearchableReel>(reels: T[], query: string, track: string | null = null): SearchHit<T>[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const pool = track ? reels.filter((r) => r.track === track) : reels;
  if (words.length === 0) return track ? pool.map((reel) => ({ reel, snippet: null })) : [];

  const hits: Array<SearchHit<T> & { rank: number }> = [];
  for (const reel of pool) {
    const body = sceneText(reel.scenes);
    const haystack = `${reel.title} ${body} ${reel.track} ${reel.studyTitle}`.toLowerCase();
    if (!words.every((w) => haystack.includes(w))) continue;
    const title = reel.title.toLowerCase();
    const inTitle = words.filter((w) => title.includes(w)).length;
    const bodyWord = words.find((w) => !title.includes(w) && body.toLowerCase().includes(w));
    hits.push({ reel, snippet: bodyWord ? snippetAround(body, bodyWord) : null, rank: inTitle });
  }
  // Stable sort keeps feed order within the same rank.
  return hits.sort((a, b) => b.rank - a.rank).map(({ reel, snippet }) => ({ reel, snippet }));
}

/** Distinct categories (tracks) in feed order. */
export function reelTracks(reels: SearchableReel[]): string[] {
  return [...new Set(reels.map((r) => r.track))];
}
