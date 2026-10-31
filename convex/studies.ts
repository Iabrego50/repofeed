import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { hasRole, requireRole, requireStudy } from "./lib/access";
import { verifyScenes } from "./lib/verify";
import { studySourceIndex } from "./generation/jobs";
import { planValidator, sceneValidator, UNTITLED_STUDY, type Plan } from "./schema/validators";
import { assertStudySlot } from "./billing/limits";
import { enforceLimit } from "./lib/rateLimit";
import { deleteUpload } from "./lib/uploads";
import { notifyStudyPublished } from "./lib/notify";

const MAX_SOURCE_CHARS = 1_000_000;

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { membership } = await requireRole(ctx, workspaceId, "member");
    const isEditor = hasRole(membership.role, "editor");
    const rows = isEditor
      ? await ctx.db
          .query("studies")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
          .order("desc")
          .take(100)
      : await ctx.db
          .query("studies")
          .withIndex("by_workspace_and_status", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", "published"),
          )
          .order("desc")
          .take(100);
    return rows.filter((s) => !s.deleting).map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      title: s.title,
      audience: s.audience,
      status: s.status,
      tracks: s.tracks,
      publishedAt: s.publishedAt,
      isDemo: s.isDemo ?? false,
    }));
  },
});

export const get = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    const { study, membership } = await requireStudy(ctx, studyId, "member");
    return { ...study, role: membership.role };
  },
});

const studyArgs = {
  workspaceId: v.id("workspaces"),
  title: v.string(),
  audience: v.string(),
  goal: v.optional(v.string()),
};

export const UNTITLED = UNTITLED_STUDY;

async function insertStudy(
  ctx: MutationCtx,
  args: { workspaceId: Id<"workspaces">; title: string; audience: string; goal?: string },
  plan: Plan,
): Promise<Id<"studies">> {
  const { user } = await requireRole(ctx, args.workspaceId, "editor");
  // Files come first; the title can be filled in (or suggested by AI) afterwards.
  const title = args.title.trim() || UNTITLED;
  await assertStudySlot(ctx, args.workspaceId, plan);
  return await ctx.db.insert("studies", {
    workspaceId: args.workspaceId,
    title: title.slice(0, 120),
    audience: args.audience.trim().slice(0, 200),
    goal: args.goal?.trim().slice(0, 300) || undefined,
    status: "draft",
    tracks: [],
    createdBy: user._id,
  });
}

/** Free-plan path. Paid workspaces go through `billing.actions.createStudy`. */
export const create = mutation({
  args: studyArgs,
  handler: async (ctx, args): Promise<Id<"studies">> => insertStudy(ctx, args, "free"),
});

export const createWithPlan = internalMutation({
  args: { ...studyArgs, plan: planValidator },
  handler: async (ctx, { plan, ...args }): Promise<Id<"studies">> => insertStudy(ctx, args, plan),
});

export const updateDetails = mutation({
  args: {
    studyId: v.id("studies"),
    title: v.string(),
    audience: v.string(),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStudy(ctx, args.studyId, "editor");
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Add a title" });
    }
    await ctx.db.patch("studies", args.studyId, {
      title: title.slice(0, 120),
      audience: args.audience.trim().slice(0, 200),
      goal: args.goal?.trim().slice(0, 300) || undefined,
    });
    return null;
  },
});

/** Hides a study from the feed and frees its plan slot. Reversible with `restore`. */
export const archive = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    const { study } = await requireStudy(ctx, studyId, "editor");
    if (study.status === "generating") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Stop generation before archiving this study",
      });
    }
    await ctx.db.patch("studies", studyId, { status: "archived" });
    return null;
  },
});

/** Kept for older clients; archiving is the non-destructive "remove". */
export const remove = archive;

async function restoreStudy(ctx: MutationCtx, studyId: Id<"studies">, plan: Plan): Promise<null> {
  const { study } = await requireStudy(ctx, studyId, "editor");
  if (study.status !== "archived") return null;
  if (!study.isDemo) await assertStudySlot(ctx, study.workspaceId, plan);
  // Restored studies come back unpublished so nothing reappears in the feed by surprise.
  await ctx.db.patch("studies", studyId, { status: study.tracks.length > 0 ? "review" : "draft" });
  return null;
}

/** Free-plan path. Paid workspaces go through `billing.actions.restoreStudy`. */
export const restore = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<null> => restoreStudy(ctx, studyId, "free"),
});

export const restoreWithPlan = internalMutation({
  args: { studyId: v.id("studies"), plan: planValidator },
  handler: async (ctx, { studyId, plan }): Promise<null> => restoreStudy(ctx, studyId, plan),
});

/** Permanently deletes a study, its scenes, sources, reactions and comments. */
export const destroy = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    const { study } = await requireStudy(ctx, studyId, "editor");
    if (study.status === "generating") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Stop generation before deleting this study",
      });
    }
    // Archive first so it leaves the feed and plan count immediately.
    await ctx.db.patch("studies", studyId, { status: "archived", deleting: true });
    await ctx.scheduler.runAfter(0, internal.studyCleanup.purgeStudy, { studyId });
    return null;
  },
});

// ---------- Sources (editor-only) ----------

/**
 * Original research files never leave the client's device: the browser extracts
 * the text and only that text is sent here.
 */
export const addSource = mutation({
  args: {
    studyId: v.id("studies"),
    name: v.string(),
    text: v.string(),
    fromFile: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"sources">> => {
    const { study } = await requireStudy(ctx, args.studyId, "editor");
    await enforceLimit(ctx, "upload", study.workspaceId);
    const text = args.text.trim();
    if (!text) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No readable text was found in this file",
      });
    }
    if (text.length > MAX_SOURCE_CHARS) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "This file has over 1 million characters. Split it and upload the parts.",
      });
    }
    return await ctx.db.insert("sources", {
      studyId: args.studyId,
      workspaceId: study.workspaceId,
      name: args.name.trim().slice(0, 200) || "Pasted text",
      kind: args.fromFile ? "file" : "paste",
      text,
      chars: text.length,
    });
  },
});

export const listSources = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    await requireStudy(ctx, studyId, "editor");
    const rows = await ctx.db
      .query("sources")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(100);
    return rows.map((s) => ({
      _id: s._id,
      name: s.name,
      kind: s.kind,
      chars: s.chars,
    }));
  },
});

export const removeSource = mutation({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get("sources", sourceId);
    if (!source) return null;
    const { study } = await requireStudy(ctx, source.studyId, "editor");
    if (source.storageId) await deleteUpload(ctx, source.storageId, study.workspaceId);
    await ctx.db.delete("sources", sourceId);
    return null;
  },
});

// ---------- Review ----------

export const reviewReels = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    await requireStudy(ctx, studyId, "editor");
    return await ctx.db
      .query("reels")
      .withIndex("by_study_and_position", (q) => q.eq("studyId", studyId))
      .take(100);
  },
});

export const setReelEnabled = mutation({
  args: { reelId: v.id("reels"), enabled: v.boolean() },
  handler: async (ctx, { reelId, enabled }) => {
    const reel = await ctx.db.get("reels", reelId);
    if (!reel) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Scene not found" });
    }
    await requireStudy(ctx, reel.studyId, "editor");
    await ctx.db.patch("reels", reelId, { enabled });
    return null;
  },
});

/** Saves edited scene text and re-runs verification against the sources. */
export const updateReelScenes = mutation({
  args: {
    reelId: v.id("reels"),
    title: v.string(),
    scenes: v.array(sceneValidator),
  },
  handler: async (ctx, { reelId, title, scenes }) => {
    const reel = await ctx.db.get("reels", reelId);
    if (!reel) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Scene not found" });
    }
    await requireStudy(ctx, reel.studyId, "editor");
    if (scenes.length < 1) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "A scene needs at least one beat" });
    }
    const index = await studySourceIndex(ctx, reel.studyId);
    const warning = verifyScenes(scenes, index);
    await ctx.db.patch("reels", reelId, {
      title: title.trim() || reel.title,
      scenes,
      warning,
      // A newly flagged reel is excluded; a reel that now passes keeps its toggle.
      enabled: warning ? false : reel.enabled,
    });
    return { warning };
  },
});

export const setPublished = mutation({
  args: { studyId: v.id("studies"), published: v.boolean() },
  handler: async (ctx, { studyId, published }) => {
    const { study, user } = await requireStudy(ctx, studyId, "editor");
    if (study.status === "generating") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Wait for generation to finish before publishing",
      });
    }
    if (published) {
      const enabled = await ctx.db
        .query("reels")
        .withIndex("by_study_and_position", (q) => q.eq("studyId", studyId))
        .take(100);
      if (!enabled.some((r) => r.enabled)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Include at least one scene before publishing",
        });
      }
    }
    await ctx.db.patch("studies", studyId, {
      status: published ? "published" : "review",
      publishedAt: published ? new Date().toISOString() : study.publishedAt,
    });
    // Only the first publish emails the team; unpublishing and republishing stays quiet.
    if (published && !study.publishedAt) await notifyStudyPublished(ctx, study, user);
    return null;
  },
});
