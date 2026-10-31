import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { deleteUpload } from "./lib/uploads";

const BATCH = 50;

/**
 * One-off cleanup: deletes original research files stored before files stayed
 * on the client's device. The extracted text is kept. Safe to re-run.
 */
export const purgeStoredSourceFiles = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<null> => {
    const page = await ctx.db.query("sources").paginate({ numItems: BATCH, cursor });
    for (const source of page.page) {
      if (!source.storageId) continue;
      // Skip files already gone so one missing file can't stall the cleanup.
      if (await ctx.db.system.get("_storage", source.storageId)) {
        await deleteUpload(ctx, source.storageId, source.workspaceId);
      }
      await ctx.db.patch("sources", source._id, { storageId: undefined });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.purgeStoredSourceFiles, { cursor: page.continueCursor });
    }
    return null;
  },
});

/**
 * One-off backfill: fills guest-only comment totals on existing scene counters,
 * so share links that hide team comments show accurate counts. Safe to re-run.
 */
export const backfillGuestCommentCounts = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<null> => {
    const page = await ctx.db.query("reelCounters").paginate({ numItems: BATCH, cursor });
    for (const counter of page.page) {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_reel", (q) => q.eq("reelId", counter.reelId))
        .take(300);
      const guest = comments.filter((c) => c.guestId !== undefined);
      await ctx.db.patch("reelCounters", counter._id, {
        guestCommentCount: guest.length,
        guestOpenCount: guest.filter((c) => c.kind !== "note" && !c.resolved).length,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillGuestCommentCounts, { cursor: page.continueCursor });
    }
    return null;
  },
});
