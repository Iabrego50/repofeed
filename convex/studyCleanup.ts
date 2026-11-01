import { v } from "convex/values";
import type { Doc, TableNames } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { deleteUpload } from "./lib/uploads";

const BATCH = 200;

/** Tables holding per-study rows, each with a `by_study` index. */
const STUDY_TABLES = [
  "reactions",
  "reelViews",
  "savedReels",
  "guestReactions",
  "guestViews",
  "comments",
  "reelCounters",
  "guests",
  "shareLinks",
  "findings",
  "generationJobs",
] as const satisfies readonly TableNames[];

/** Deletes one batch of rows for the study; returns true once nothing is left. */
async function purgeBatch(ctx: MutationCtx, study: Doc<"studies">): Promise<boolean> {
  const studyId = study._id;
  for (const table of STUDY_TABLES) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(BATCH);
    if (rows.length === 0) continue;
    for (const row of rows) await ctx.db.delete(table, row._id);
    return false;
  }

  const sources = await ctx.db
    .query("sources")
    .withIndex("by_study", (q) => q.eq("studyId", studyId))
    .take(50);
  if (sources.length > 0) {
    for (const s of sources) {
      if (s.storageId) await deleteUpload(ctx, s.storageId, study.workspaceId);
      await ctx.db.delete("sources", s._id);
    }
    return false;
  }

  const reels = await ctx.db
    .query("reels")
    .withIndex("by_study_and_position", (q) => q.eq("studyId", studyId))
    .take(50);
  if (reels.length > 0) {
    for (const r of reels) {
      // AI-painted backdrops belong to the reel; uploaded clips stay in the workspace library.
      if (r.footage?.storageId) await deleteUpload(ctx, r.footage.storageId, study.workspaceId);
      await ctx.db.delete("reels", r._id);
    }
    return false;
  }
  return true;
}

/** Permanently removes a study and everything generated from it, in batches. */
export const purgeStudy = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<null> => {
    const study = await ctx.db.get("studies", studyId);
    if (!study) return null;
    const done = await purgeBatch(ctx, study);
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.studyCleanup.purgeStudy, { studyId });
      return null;
    }
    const decks = await ctx.db
      .query("decks")
      .withIndex("by_workspace_and_scope", (q) => q.eq("workspaceId", study.workspaceId).eq("scope", studyId))
      .take(50);
    for (const d of decks) await ctx.db.delete("decks", d._id);
    await ctx.db.delete("studies", studyId);
    return null;
  },
});

/** One-off: mark existing seeded demo studies so they stop counting toward the Free limit. */
export const backfillDemoFlag = internalMutation({
  args: { title: v.string() },
  handler: async (ctx, { title }): Promise<number> => {
    const studies = await ctx.db.query("studies").take(1000);
    let patched = 0;
    for (const s of studies) {
      if (s.title === title && !s.isDemo) {
        await ctx.db.patch("studies", s._id, { isDemo: true });
        patched++;
      }
    }
    return patched;
  },
});
