import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireReel, requireRole } from "./lib/access";
import { STOCK_CLIPS, isStockClip } from "./lib/footageLibrary";
import { releaseArt } from "./art";
import { enforceLimit } from "./lib/rateLimit";
import { claimUpload, deleteUpload } from "./lib/uploads";

const MAX_CLIP_BYTES = 60 * 1024 * 1024;
const MAX_CLIPS = 100;
const MAX_CAPTION = 60;

/** The workspace's uploaded clips plus the built-in stock clips. */
export const library = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireRole(ctx, workspaceId, "editor");
    const uploads = await ctx.db
      .query("footageClips")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(MAX_CLIPS);
    return {
      uploads: uploads.map((c) => ({ _id: c._id, url: c.url, name: c.name, size: c.size })),
      stock: STOCK_CLIPS,
    };
  },
});

const PRO_FEATURE = "Uploaded footage clips";

/** Pro feature: an upload URL for a new footage clip. */
export const generateUploadUrl = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<string> => {
    await ctx.runAction(internal.billing.actions.requirePaid, { workspaceId, feature: PRO_FEATURE });
    return await ctx.runMutation(internal.footage.uploadUrlWithPlan, { workspaceId });
  },
});

export const uploadUrlWithPlan = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<string> => {
    await requireRole(ctx, workspaceId, "editor");
    await enforceLimit(ctx, "upload", workspaceId);
    return await ctx.storage.generateUploadUrl();
  },
});

const saveArgs = {
  workspaceId: v.id("workspaces"),
  storageId: v.id("_storage"),
  name: v.string(),
};

/** Pro feature: saves an uploaded clip to the workspace library. */
export const saveUpload = action({
  args: saveArgs,
  handler: async (ctx, args): Promise<Id<"footageClips">> => {
    await ctx.runAction(internal.billing.actions.requirePaid, { workspaceId: args.workspaceId, feature: PRO_FEATURE });
    return await ctx.runMutation(internal.footage.saveUploadWithPlan, args);
  },
});

export const saveUploadWithPlan = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"footageClips">> => {
    const { user } = await requireRole(ctx, args.workspaceId, "editor");
    const meta = await claimUpload(ctx, args.storageId, args.workspaceId);
    const reject = async (message: string): Promise<never> => {
      await deleteUpload(ctx, args.storageId, args.workspaceId);
      throw new ConvexError({ code: "BAD_REQUEST", message });
    };
    // Uploads always send a Content-Type; only reject when it's known and not a video.
    if (meta.contentType && !meta.contentType.startsWith("video/")) await reject("Only video files can be used as footage");
    if (meta.size > MAX_CLIP_BYTES) await reject("Clips must be 60 MB or smaller");
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) await reject("Couldn't read the uploaded clip");
    return await ctx.db.insert("footageClips", {
      workspaceId: args.workspaceId,
      storageId: args.storageId,
      url: url ?? "",
      name: args.name.trim().slice(0, 120) || "Clip",
      size: meta.size,
      uploadedBy: user._id,
    });
  },
});

/** Deletes an uploaded clip and clears it from every reel that used it. */
export const removeUpload = mutation({
  args: { clipId: v.id("footageClips") },
  handler: async (ctx, { clipId }) => {
    const clip = await ctx.db.get("footageClips", clipId);
    if (!clip) return { cleared: 0 };
    await requireRole(ctx, clip.workspaceId, "editor");
    const reels = await ctx.db
      .query("reels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", clip.workspaceId))
      .take(2000);
    let cleared = 0;
    for (const reel of reels) {
      if (reel.footage?.clipId !== clipId) continue;
      await ctx.db.patch("reels", reel._id, { footage: undefined });
      cleared++;
    }
    await deleteUpload(ctx, clip.storageId, clip.workspaceId);
    await ctx.db.delete("footageClips", clipId);
    return { cleared };
  },
});

/** Sets, changes or removes a reel's background clip and its REC caption. */
export const setReelFootage = mutation({
  args: {
    reelId: v.id("reels"),
    footage: v.union(
      v.null(),
      v.object({
        caption: v.string(),
        source: v.union(
          v.object({ kind: v.literal("upload"), clipId: v.id("footageClips") }),
          v.object({ kind: v.literal("stock"), url: v.string() }),
        ),
      }),
    ),
  },
  handler: async (ctx, { reelId, footage }) => {
    const { reel } = await requireReel(ctx, reelId, "editor");
    // A manual choice replaces any AI scene and cancels one still being painted.
    await releaseArt(ctx, reel);
    if (footage === null) {
      await ctx.db.patch("reels", reelId, { footage: undefined, art: undefined });
      return null;
    }
    const caption = footage.caption.trim().slice(0, MAX_CAPTION);
    const { source } = footage;
    if (source.kind === "stock") {
      if (!isStockClip(source.url)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Unknown stock clip" });
      }
      await ctx.db.patch("reels", reelId, { footage: { url: source.url, caption }, art: undefined });
      return null;
    }
    const clip = await ctx.db.get("footageClips", source.clipId);
    if (!clip || clip.workspaceId !== reel.workspaceId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That clip was deleted" });
    }
    await ctx.db.patch("reels", reelId, {
      footage: { url: clip.url, caption, clipId: clip._id },
      art: undefined,
    });
    return null;
  },
});
