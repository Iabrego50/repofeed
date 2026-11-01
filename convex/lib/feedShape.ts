import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { ReactionKind } from "../schema/validators";
import { EMPTY_COUNTS } from "./counters";

/** Enabled reels of a study, in feed order. */
export async function enabledReels(
  ctx: QueryCtx,
  studyId: Id<"studies">,
): Promise<Doc<"reels">[]> {
  const reels = await ctx.db
    .query("reels")
    .withIndex("by_study_and_position", (q) => q.eq("studyId", studyId))
    .take(100);
  return reels.filter((r) => r.enabled);
}

export async function reelCounts(ctx: QueryCtx, reelId: Id<"reels">) {
  const counts = await ctx.db
    .query("reelCounters")
    .withIndex("by_reel", (q) => q.eq("reelId", reelId))
    .unique();
  if (!counts) return { ...EMPTY_COUNTS, guestCommentCount: 0, guestOpenCount: 0 };
  return { ...counts, guestCommentCount: counts.guestCommentCount ?? 0, guestOpenCount: counts.guestOpenCount ?? 0 };
}

/** The single reel shape used by both the member feed and share-link feed. */
export function toFeedReel(
  study: Doc<"studies">,
  reel: Doc<"reels">,
  counts: typeof EMPTY_COUNTS,
  myReaction: ReactionKind | null,
  seen = false,
  saved = false,
) {
  return {
    _id: reel._id,
    studyId: study._id,
    studyTitle: study.title,
    track: reel.track,
    trackIndex: reel.trackIndex,
    title: reel.title,
    scenes: reel.scenes,
    footage: reel.footage ?? null,
    sourceNames: reel.sourceNames,
    counts: {
      trueCount: counts.trueCount,
      surprisedCount: counts.surprisedCount,
      pushbackCount: counts.pushbackCount,
      commentCount: counts.commentCount,
      openCount: counts.openCount,
      views: counts.views,
      viewers: counts.viewers,
      completions: counts.completions,
    },
    myReaction,
    /** Whether the current viewer has already watched this scene. */
    seen,
    /** Whether the current member saved this scene to their list (always false for guests). */
    saved,
  };
}

export async function reelEvidence(ctx: QueryCtx, reel: Doc<"reels">) {
  const findings = await Promise.all(
    reel.findingIds.map((id) => ctx.db.get("findings", id)),
  );
  return findings
    .filter((f) => f !== null)
    .map((f) => ({
      _id: f._id,
      type: f.type,
      text: f.text,
      speaker: f.speaker,
      number: f.number,
      label: f.label,
    }));
}
