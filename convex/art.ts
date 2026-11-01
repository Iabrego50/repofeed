import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { requireReel, requireStudy } from "./lib/access";
import { enforceLimit } from "./lib/rateLimit";
import { deleteUpload } from "./lib/uploads";
import { ART_SYSTEM, ART_TOOL, artCaption, artSchema, artUserPrompt, imagePrompt } from "./lib/art";
import { toStepError } from "./lib/stepError";
import { callTool, generateImage } from "./generation/ai";

const MAX_REELS = 100;
// Spread requests out so a whole study doesn't hit the image service at once.
const STAGGER_MS = 4_000;

/** Deletes the reel's AI-painted file, if it owns one. */
export async function releaseArt(ctx: MutationCtx, reel: Doc<"reels">) {
  if (reel.footage?.storageId) await deleteUpload(ctx, reel.footage.storageId, reel.workspaceId);
}

/** Marks reels as pending and schedules one painting job per reel. */
async function queue(ctx: MutationCtx, reels: Doc<"reels">[]): Promise<number> {
  for (const [i, reel] of reels.entries()) {
    await ctx.db.patch("reels", reel._id, { art: { status: "pending" } });
    await ctx.scheduler.runAfter(i * STAGGER_MS, internal.art.paint, { reelId: reel._id });
  }
  return reels.length;
}

async function studyReels(ctx: MutationCtx, studyId: Id<"studies">) {
  return await ctx.db
    .query("reels")
    .withIndex("by_study_and_position", (q) => q.eq("studyId", studyId))
    .take(MAX_REELS);
}

/**
 * After a study is generated, Pro and Team workspaces get an AI scene for
 * every reel (stock stays as the placeholder). Free workspaces keep stock clips.
 */
export async function queueNewStudy(ctx: MutationCtx, studyId: Id<"studies">, workspaceId: Id<"workspaces">): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.art.autoPaint, { studyId, workspaceId });
}

export const autoPaint = internalAction({
  args: { studyId: v.id("studies"), workspaceId: v.id("workspaces") },
  handler: async (ctx, { studyId, workspaceId }): Promise<null> => {
    if (!(await ctx.runAction(internal.billing.actions.isPaid, { workspaceId }))) return null;
    await ctx.runMutation(internal.art.queueStudyReels, { studyId });
    return null;
  },
});

export const queueStudyReels = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<number> => await queue(ctx, await studyReels(ctx, studyId)),
});

const PRO_FEATURE = "AI backdrops";

/** Editor: paint (or repaint) the scene behind one reel. Pro feature. */
export const paintReel = action({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }): Promise<null> => {
    const workspaceId = await ctx.runQuery(internal.art.reelWorkspace, { reelId });
    if (!workspaceId) throw new ConvexError({ code: "NOT_FOUND", message: "Scene not found" });
    await ctx.runAction(internal.billing.actions.requirePaid, { workspaceId, feature: PRO_FEATURE });
    return await ctx.runMutation(internal.art.paintReelWithPlan, { reelId });
  },
});

export const paintReelWithPlan = internalMutation({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }): Promise<null> => {
    const { reel } = await requireReel(ctx, reelId, "editor");
    if (reel.art?.status === "pending") return null;
    await enforceLimit(ctx, "paint", reel.workspaceId);
    await queue(ctx, [reel]);
    return null;
  },
});

/** Editor: paint scenes for every reel in a study that doesn't have its own footage or AI scene yet. Pro feature. */
export const paintStudy = action({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<number> => {
    const workspaceId = await ctx.runQuery(internal.billing.data.studyWorkspace, { studyId });
    if (!workspaceId) throw new ConvexError({ code: "NOT_FOUND", message: "Study not found" });
    await ctx.runAction(internal.billing.actions.requirePaid, { workspaceId, feature: PRO_FEATURE });
    return await ctx.runMutation(internal.art.paintStudyWithPlan, { studyId });
  },
});

export const paintStudyWithPlan = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<number> => {
    const { study } = await requireStudy(ctx, studyId, "editor");
    const reels = await studyReels(ctx, studyId);
    const todo = reels.filter((r) => r.art?.status !== "pending" && !r.footage?.clipId && r.footage?.media !== "image");
    if (!todo.length) {
      throw new ConvexError({ code: "CONFLICT", message: "Every scene already has its own backdrop" });
    }
    await enforceLimit(ctx, "paint", study.workspaceId, todo.length);
    return await queue(ctx, todo);
  },
});

export const reelWorkspace = internalQuery({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => (await ctx.db.get("reels", reelId))?.workspaceId ?? null,
});

export const reelForArt = internalQuery({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }) => {
    const reel = await ctx.db.get("reels", reelId);
    if (!reel || reel.art?.status !== "pending") return null;
    const study = await ctx.db.get("studies", reel.studyId);
    return { title: reel.title, track: reel.track, scenes: reel.scenes, studyTitle: study?.title ?? "" };
  },
});

export const saveArt = internalMutation({
  args: { reelId: v.id("reels"), storageId: v.id("_storage"), caption: v.string() },
  handler: async (ctx, { reelId, storageId, caption }) => {
    const reel = await ctx.db.get("reels", reelId);
    const url = await ctx.storage.getUrl(storageId);
    // The reel was deleted, or an editor picked other footage while we were painting.
    if (!reel || reel.art?.status !== "pending" || !url) {
      await ctx.storage.delete(storageId);
      return null;
    }
    await releaseArt(ctx, reel);
    // Record ownership so the painted file can't be claimed by another workspace.
    await ctx.db.insert("uploadClaims", { storageId, workspaceId: reel.workspaceId });
    await ctx.db.patch("reels", reelId, {
      footage: { url, caption, media: "image", storageId },
      art: undefined,
    });
    return null;
  },
});

export const failArt = internalMutation({
  args: { reelId: v.id("reels"), error: v.string() },
  handler: async (ctx, { reelId, error }) => {
    const reel = await ctx.db.get("reels", reelId);
    if (!reel || reel.art?.status !== "pending") return null;
    await ctx.db.patch("reels", reelId, { art: { status: "failed", error } });
    return null;
  },
});

/** Claude writes the scene, the image model paints it, and it's attached to the reel. */
export const paint = internalAction({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }): Promise<null> => {
    const reel = await ctx.runQuery(internal.art.reelForArt, { reelId });
    if (!reel) return null;
    try {
      const scene = await callTool({ system: ART_SYSTEM, user: artUserPrompt(reel), tool: ART_TOOL, schema: artSchema, maxTokens: 800 });
      const image = await generateImage(imagePrompt(scene.prompt));
      const storageId = await ctx.storage.store(image);
      await ctx.runMutation(internal.art.saveArt, { reelId, storageId, caption: artCaption(scene.caption) });
    } catch (err) {
      const e = toStepError(err);
      console.error("Scene painting failed", reelId, e.detail);
      await ctx.runMutation(internal.art.failArt, { reelId, error: e.message });
    }
    return null;
  },
});

/** One-off: paint scenes for every reel that has no background at all. */
export const backfillMissing = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const reels = await ctx.db.query("reels").take(1000);
    return await queue(ctx, reels.filter((r) => !r.footage && r.art?.status !== "pending"));
  },
});
