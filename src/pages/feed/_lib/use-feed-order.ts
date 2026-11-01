import { useState } from "react";
import type { FeedReel } from "./types.ts";

type Order = { key: string | undefined; ids: string[]; fresh: Set<string> };

/** Unwatched first, keeping each group in publish order. */
function initialOrder(reels: FeedReel[]): string[] {
  return [...reels.filter((r) => !r.seen), ...reels.filter((r) => r.seen)].map((r) => r._id || r.id).filter((id): id is string => !!id);
}

/**
 * Puts unwatched scenes first, then freezes that order so the feed doesn't
 * reshuffle under the viewer as they watch. Scenes published later are appended.
 * `fresh` remembers which scenes were new when the feed opened, for the badge.
 */
export function useFeedOrder(reels: FeedReel[] | undefined, resetKey: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  if (!reels) return { ordered: undefined, fresh: new Set<string>() };

  let next = order;
  if (!next || next.key !== resetKey) {
    const freshIds = reels.filter((r) => !r.seen).map((r) => r._id || r.id).filter((id): id is string => !!id);
    next = { key: resetKey, ids: initialOrder(reels), fresh: new Set(freshIds) };
  } else {
    const live = new Set<string>(reels.map((r) => r._id || r.id).filter((id): id is string => !!id));
    const known = new Set(next.ids);
    const added = reels.filter((r) => !known.has((r._id || r.id) as string));
    const kept = next.ids.filter((id) => live.has(id));
    if (added.length > 0 || kept.length !== next.ids.length) {
      const fresh = new Set(next.fresh);
      for (const r of added) {
        const rid = r._id || r.id;
        if (!r.seen && rid) fresh.add(rid);
      }
      next = { key: resetKey, ids: [...kept, ...added.map((r) => r._id || r.id).filter((id): id is string => !!id)], fresh };
    }
  }
  if (next !== order) setOrder(next);

  const byId = new Map(reels.map((r) => [(r._id || r.id) as string, r]));
  const ordered = next.ids.map((id) => byId.get(id)).filter((r): r is FeedReel => r !== undefined);
  return { ordered, fresh: next.fresh };
}
