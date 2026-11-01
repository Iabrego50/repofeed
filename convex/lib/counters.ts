import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type CounterField =
  | "trueCount"
  | "surprisedCount"
  | "pushbackCount"
  | "commentCount"
  | "openCount"
  | "guestCommentCount"
  | "guestOpenCount"
  | "views"
  | "viewers"
  | "completions";

export const REACTION_FIELD = {
  true: "trueCount",
  surprised: "surprisedCount",
  pushback: "pushbackCount",
} as const satisfies Record<string, CounterField>;

export async function bumpCounter(
  ctx: MutationCtx,
  reel: Doc<"reels">,
  deltas: Partial<Record<CounterField, number>>,
): Promise<void> {
  const existing = await ctx.db
    .query("reelCounters")
    .withIndex("by_reel", (q) => q.eq("reelId", reel._id))
    .unique();
  const next: Record<CounterField, number> = {
    trueCount: existing?.trueCount ?? 0,
    surprisedCount: existing?.surprisedCount ?? 0,
    pushbackCount: existing?.pushbackCount ?? 0,
    commentCount: existing?.commentCount ?? 0,
    openCount: existing?.openCount ?? 0,
    guestCommentCount: existing?.guestCommentCount ?? 0,
    guestOpenCount: existing?.guestOpenCount ?? 0,
    views: existing?.views ?? 0,
    viewers: existing?.viewers ?? 0,
    completions: existing?.completions ?? 0,
  };
  for (const [k, d] of Object.entries(deltas) as Array<[CounterField, number]>) {
    next[k] = Math.max(0, next[k] + d);
  }
  if (existing) {
    await ctx.db.patch("reelCounters", existing._id, next);
  } else {
    await ctx.db.insert("reelCounters", {
      reelId: reel._id,
      studyId: reel.studyId,
      ...next,
    });
  }
}

export const EMPTY_COUNTS = {
  trueCount: 0,
  surprisedCount: 0,
  pushbackCount: 0,
  commentCount: 0,
  openCount: 0,
  views: 0,
  viewers: 0,
  completions: 0,
};

export type ReelId = Id<"reels">;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A person's repeat plays only count as a new view once per day, so totals can't run away. */
export function countsAsNewView(lastViewedAt: string, now: Date): boolean {
  return now.getTime() - new Date(lastViewedAt).getTime() >= DAY_MS;
}
