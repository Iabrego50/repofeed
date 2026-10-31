import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/access";
import { getPrefs } from "./lib/notify";

/** The current person's email update settings for this workspace (on by default). */
export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { user } = await requireRole(ctx, workspaceId, "member");
    const prefs = await getPrefs(ctx, workspaceId, user._id);
    return { email: user.email ?? null, newStudies: prefs.newStudies, feedback: prefs.feedback };
  },
});

export const set = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    newStudies: v.optional(v.boolean()),
    feedback: v.optional(v.boolean()),
  },
  handler: async (ctx, { workspaceId, newStudies, feedback }) => {
    const { user } = await requireRole(ctx, workspaceId, "member");
    const existing = await ctx.db
      .query("emailPrefs")
      .withIndex("by_workspace_and_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", user._id))
      .unique();
    const next = {
      newStudies: newStudies ?? existing?.newStudies ?? true,
      feedback: feedback ?? existing?.feedback ?? true,
    };
    if (existing) await ctx.db.patch("emailPrefs", existing._id, next);
    else await ctx.db.insert("emailPrefs", { workspaceId, userId: user._id, ...next });
    return null;
  },
});
