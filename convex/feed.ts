import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { hasRole, requireReel, requireRole } from "./lib/access";
import { bumpCounter, countsAsNewView, REACTION_FIELD } from "./lib/counters";
import { insertComment, listComments, removeComment } from "./lib/comments";
import { notifyComment, notifyReaction } from "./lib/notify";
import { enabledReels, reelCounts, reelEvidence, toFeedReel } from "./lib/feedShape";
import { commentKindValidator, reactionKindValidator } from "./schema/validators";

const MAX_FEED_STUDIES = 20;
// The Saved list shows the most recent saves; older ones stay stored but out of view.
const MAX_SAVED = 200;

/** One reel in the member feed, with this member's reaction, view and save state. */
async function memberFeedReel(
  ctx: QueryCtx,
  study: Doc<"studies">,
  reel: Doc<"reels">,
  userId: Id<"users">,
  knownSaved?: boolean,
) {
  const [counts, mine, view, saved] = await Promise.all([
    reelCounts(ctx, reel._id),
    ctx.db
      .query("reactions")
      .withIndex("by_reel_and_user", (q) => q.eq("reelId", reel._id).eq("userId", userId))
      .unique(),
    ctx.db
      .query("reelViews")
      .withIndex("by_reel_and_user", (q) => q.eq("reelId", reel._id).eq("userId", userId))
      .unique(),
    knownSaved ??
      ctx.db
        .query("savedReels")
        .withIndex("by_reel_and_user", (q) => q.eq("reelId", reel._id).eq("userId", userId))
        .first()
        .then((s) => s !== null),
  ]);
  return toFeedReel(study, reel, counts, mine?.kind ?? null, view !== null, saved);
}

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    studyId: v.optional(v.id("studies")),
  },
  handler: async (ctx, { workspaceId, studyId }) => {
    const { user } = await requireRole(ctx, workspaceId, "member");
    const studies = studyId
      ? [await ctx.db.get("studies", studyId)].filter(
          (s) => s && s.workspaceId === workspaceId && s.status === "published",
        )
      : await ctx.db
          .query("studies")
          .withIndex("by_workspace_and_status", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", "published"),
          )
          .order("desc")
          .take(MAX_FEED_STUDIES);

    const out = [];
    for (const study of studies) {
      if (!study) continue;
      const reels = await enabledReels(ctx, study._id);
      out.push(...(await Promise.all(reels.map((reel) => memberFeedReel(ctx, study, reel, user._id)))));
    }
    return out;
  },
});

/** The current member's Saved list in this workspace, newest save first. */
export const saved = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { user } = await requireRole(ctx, workspaceId, "member");
    const rows = await ctx.db
      .query("savedReels")
      .withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId))
      .order("desc")
      .take(MAX_SAVED);
    const studies = new Map<Id<"studies">, Doc<"studies"> | null>();
    const out = [];
    for (const row of rows) {
      const reel = await ctx.db.get("reels", row.reelId);
      // Scenes that were turned off, regenerated or unpublished drop out of the list.
      if (!reel || !reel.enabled) continue;
      if (!studies.has(reel.studyId)) studies.set(reel.studyId, await ctx.db.get("studies", reel.studyId));
      const study = studies.get(reel.studyId);
      if (!study || study.workspaceId !== workspaceId || study.status !== "published") continue;
      out.push(await memberFeedReel(ctx, study, reel, user._id, true));
    }
    return out;
  },
});

/** Adds or removes a scene from the member's Saved list. Returns whether it's now saved. */
export const toggleSave = mutation({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => {
    const { user, reel } = await requireReel(ctx, reelId, "member");
    const existing = await ctx.db
      .query("savedReels")
      .withIndex("by_reel_and_user", (q) => q.eq("reelId", reelId).eq("userId", user._id))
      .first();
    if (existing) {
      await ctx.db.delete("savedReels", existing._id);
      return false;
    }
    await ctx.db.insert("savedReels", {
      userId: user._id,
      workspaceId: reel.workspaceId,
      reelId,
      studyId: reel.studyId,
    });
    return true;
  },
});

export const evidence = query({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => {
    const { reel } = await requireReel(ctx, reelId, "member");
    return await reelEvidence(ctx, reel);
  },
});

export const setReaction = mutation({
  args: { reelId: v.id("reels"), kind: reactionKindValidator },
  handler: async (ctx, { reelId, kind }) => {
    const { user, reel } = await requireReel(ctx, reelId, "member");
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_reel_and_user", (q) =>
        q.eq("reelId", reelId).eq("userId", user._id),
      )
      .unique();
    if (existing?.kind === kind) {
      // Tapping the same reaction again removes it.
      await ctx.db.delete("reactions", existing._id);
      await bumpCounter(ctx, reel, { [REACTION_FIELD[kind]]: -1 });
      return null;
    }
    if (existing) {
      await ctx.db.patch("reactions", existing._id, { kind });
      await bumpCounter(ctx, reel, {
        [REACTION_FIELD[existing.kind]]: -1,
        [REACTION_FIELD[kind]]: 1,
      });
      await notifyReaction(ctx, reel, { userId: user._id }, kind);
      return kind;
    }
    await ctx.db.insert("reactions", {
      reelId,
      studyId: reel.studyId,
      userId: user._id,
      kind,
    });
    await bumpCounter(ctx, reel, { [REACTION_FIELD[kind]]: 1 });
    await notifyReaction(ctx, reel, { userId: user._id }, kind);
    return kind;
  },
});

export const recordView = mutation({
  args: { reelId: v.id("reels"), completed: v.boolean() },
  handler: async (ctx, { reelId, completed }) => {
    const { user, reel } = await requireReel(ctx, reelId, "member");
    const existing = await ctx.db
      .query("reelViews")
      .withIndex("by_reel_and_user", (q) =>
        q.eq("reelId", reelId).eq("userId", user._id),
      )
      .unique();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    if (!existing) {
      await ctx.db.insert("reelViews", {
        reelId,
        studyId: reel.studyId,
        userId: user._id,
        viewCount: 1,
        completed,
        lastViewedAt: now,
      });
      await bumpCounter(ctx, reel, {
        views: 1,
        viewers: 1,
        completions: completed ? 1 : 0,
      });
      return null;
    }
    if (completed) {
      // Completion is recorded once per person, without counting a new view.
      if (!existing.completed) {
        await ctx.db.patch("reelViews", existing._id, { completed: true });
        await bumpCounter(ctx, reel, { completions: 1 });
      }
      return null;
    }
    if (!countsAsNewView(existing.lastViewedAt, nowDate)) return null;
    await ctx.db.patch("reelViews", existing._id, {
      viewCount: existing.viewCount + 1,
      lastViewedAt: now,
    });
    await bumpCounter(ctx, reel, { views: 1 });
    return null;
  },
});

// ---------- Comments ----------

export const comments = query({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => {
    const { user, membership } = await requireReel(ctx, reelId, "member");
    const isEditor = hasRole(membership.role, "editor");
    return await listComments(ctx, reelId, { userId: user._id, canModerate: isEditor }, isEditor);
  },
});

export const addComment = mutation({
  args: {
    reelId: v.id("reels"),
    kind: commentKindValidator,
    body: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const { user, reel } = await requireReel(ctx, args.reelId, "member");
    await insertComment(ctx, reel, { userId: user._id }, args);
    await notifyComment(ctx, reel, { userId: user._id }, args);
    return null;
  },
});

export const setResolved = mutation({
  args: { commentId: v.id("comments"), resolved: v.boolean() },
  handler: async (ctx, { commentId, resolved }) => {
    const comment = await ctx.db.get("comments", commentId);
    if (!comment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found" });
    }
    const { user, membership, reel } = await requireReel(ctx, comment.reelId, "member");
    if (comment.kind === "note") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Notes can't be resolved" });
    }
    if (comment.userId !== user._id && !hasRole(membership.role, "editor")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the author or an editor can resolve this",
      });
    }
    if (comment.resolved === resolved) return null;
    await ctx.db.patch("comments", commentId, { resolved });
    await bumpCounter(ctx, reel, {
      openCount: resolved ? -1 : 1,
      ...(comment.guestId ? { guestOpenCount: resolved ? -1 : 1 } : {}),
    });
    return null;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    const comment = await ctx.db.get("comments", commentId);
    if (!comment) return null;
    const { user, membership, reel } = await requireReel(ctx, comment.reelId, "member");
    // Authors delete their own; editors can moderate anyone's, including guests.
    if (comment.userId !== user._id && !hasRole(membership.role, "editor")) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only delete your own comments" });
    }
    await removeComment(ctx, reel, comment);
    return null;
  },
});
