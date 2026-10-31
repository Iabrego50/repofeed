import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { hasRole, requireReel, requireStudy } from "./lib/access";
import { bumpCounter, countsAsNewView, REACTION_FIELD } from "./lib/counters";
import { enabledReels, reelCounts, reelEvidence, toFeedReel } from "./lib/feedShape";
import { insertComment, listComments, removeComment } from "./lib/comments";
import { notifyComment, notifyReaction } from "./lib/notify";
import { randomToken } from "./lib/random";
import { enforceLimit, tryConsume } from "./lib/rateLimit";
import { findGuest, loadShare, requireGuest, requireShare, requireShareReel } from "./lib/share";
import { commentKindValidator, reactionKindValidator } from "./schema/validators";

// ---------- Editor controls ----------

/** The study's active share link, if any (editors only). */
export const getLink = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    await requireStudy(ctx, studyId, "editor");
    const links = await ctx.db
      .query("shareLinks")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(50);
    const live = links.find((l) => !l.revoked);
    if (!live) return null;
    const guests = await ctx.db
      .query("guests")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(500);
    return { token: live.token, guestCount: guests.length, hideTeamComments: live.hideTeamComments ?? false };
  },
});

/** Editors choose whether guests on the link can see the team's comments. */
export const setHideTeamComments = mutation({
  args: { studyId: v.id("studies"), hide: v.boolean() },
  handler: async (ctx, { studyId, hide }) => {
    await requireStudy(ctx, studyId, "editor");
    const links = await ctx.db
      .query("shareLinks")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(50);
    const live = links.find((l) => !l.revoked);
    if (!live) throw new ConvexError({ code: "NOT_FOUND", message: "Turn on the share link first" });
    await ctx.db.patch("shareLinks", live._id, { hideTeamComments: hide });
    return null;
  },
});

export const createLink = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<string> => {
    const { user, study } = await requireStudy(ctx, studyId, "editor");
    if (study.status !== "published") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Publish the study before sharing it" });
    }
    const links = await ctx.db
      .query("shareLinks")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(50);
    const live = links.find((l) => !l.revoked);
    if (live) return live.token;
    const token = randomToken();
    await ctx.db.insert("shareLinks", {
      studyId,
      workspaceId: study.workspaceId,
      token,
      createdBy: user._id,
      revoked: false,
      // New links keep internal discussion private until an editor opts in.
      hideTeamComments: true,
    });
    return token;
  },
});

export const revokeLink = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    await requireStudy(ctx, studyId, "editor");
    const links = await ctx.db
      .query("shareLinks")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(50);
    for (const l of links) {
      if (!l.revoked) await ctx.db.patch("shareLinks", l._id, { revoked: true });
    }
    return null;
  },
});

// ---------- Public (no account) ----------

async function liveLinkToken(ctx: QueryCtx | MutationCtx, studyId: Id<"studies">): Promise<string | null> {
  const links = await ctx.db
    .query("shareLinks")
    .withIndex("by_study", (q) => q.eq("studyId", studyId))
    .take(50);
  return links.find((l) => !l.revoked)?.token ?? null;
}

/**
 * Public link for one reel, so recipients skip sign-in. Uses the study's live
 * share link; editors create one if sharing isn't on yet.
 */
export const reelShareLink = mutation({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }): Promise<string> => {
    const { user, membership, study, reel } = await requireReel(ctx, reelId, "member");
    if (study.status !== "published" || !reel.enabled) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only published scenes can be shared" });
    }
    const existing = await liveLinkToken(ctx, study._id);
    if (existing) return existing;
    if (!hasRole(membership.role, "editor")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Sharing is turned off for this study. Ask an editor to turn on its share link.",
      });
    }
    const token = randomToken();
    await ctx.db.insert("shareLinks", {
      studyId: study._id,
      workspaceId: study.workspaceId,
      token,
      createdBy: user._id,
      revoked: false,
      hideTeamComments: true,
    });
    return token;
  },
});

/** For older member links (`/?reel=…`): the public share token for a reel, if sharing is on. */
export const publicTokenForReel = query({
  args: { reelId: v.string() },
  handler: async (ctx, { reelId }) => {
    const id = ctx.db.normalizeId("reels", reelId);
    if (!id) return null;
    const reel = await ctx.db.get("reels", id);
    if (!reel?.enabled) return null;
    const study = await ctx.db.get("studies", reel.studyId);
    if (!study || study.status !== "published") return null;
    return await liveLinkToken(ctx, study._id);
  },
});

/** The shared feed. `secret` identifies a returning guest so their reactions show. */
export const feed = query({
  args: { token: v.string(), secret: v.optional(v.string()) },
  handler: async (ctx, { token, secret }) => {
    const share = await loadShare(ctx, token);
    if (!share) return null;
    const { study } = share;
    const guest = await findGuest(ctx, study._id, secret);
    const reels = await enabledReels(ctx, study._id);
    const out = [];
    for (const reel of reels) {
      const [counts, mine, view] = await Promise.all([
        reelCounts(ctx, reel._id),
        guest
          ? ctx.db
              .query("guestReactions")
              .withIndex("by_reel_and_guest", (q) => q.eq("reelId", reel._id).eq("guestId", guest._id))
              .unique()
          : null,
        guest
          ? ctx.db
              .query("guestViews")
              .withIndex("by_reel_and_guest", (q) => q.eq("reelId", reel._id).eq("guestId", guest._id))
              .unique()
          : null,
      ]);
      const visibleCounts = share.link.hideTeamComments
        ? { ...counts, commentCount: counts.guestCommentCount, openCount: counts.guestOpenCount }
        : counts;
      out.push(toFeedReel(study, reel, visibleCounts, mine?.kind ?? null, view !== null));
    }
    return {
      studyTitle: study.title,
      guest: guest ? { name: guest.name } : null,
      reels: out,
    };
  },
});

export const join = mutation({
  args: { token: v.string(), name: v.string() },
  handler: async (ctx, { token, name }): Promise<{ secret: string; name: string }> => {
    const { link, study } = await requireShare(ctx, token);
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a name between 2 and 60 characters" });
    }
    await enforceLimit(ctx, "guestJoin", link._id);
    const secret = randomToken(24);
    await ctx.db.insert("guests", { studyId: study._id, linkId: link._id, name: trimmed, secret });
    return { secret, name: trimmed };
  },
});

export const rename = mutation({
  args: { token: v.string(), secret: v.string(), name: v.string() },
  handler: async (ctx, { token, secret, name }) => {
    const { guest } = await requireGuest(ctx, token, secret);
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a name between 2 and 60 characters" });
    }
    await ctx.db.patch("guests", guest._id, { name: trimmed });
    return null;
  },
});

export const evidence = query({
  args: { token: v.string(), reelId: v.id("reels") },
  handler: async (ctx, { token, reelId }) => {
    const { study } = await requireShare(ctx, token);
    const reel = await requireShareReel(ctx, study, reelId);
    return await reelEvidence(ctx, reel);
  },
});

export const comments = query({
  args: { token: v.string(), reelId: v.id("reels"), secret: v.optional(v.string()) },
  handler: async (ctx, { token, reelId, secret }) => {
    const { study, link } = await requireShare(ctx, token);
    await requireShareReel(ctx, study, reelId);
    const guest = await findGuest(ctx, study._id, secret);
    return await listComments(
      ctx,
      reelId,
      { guestId: guest?._id, guestView: { hideTeam: link.hideTeamComments === true } },
      false,
    );
  },
});

export const setReaction = mutation({
  args: { token: v.string(), secret: v.string(), reelId: v.id("reels"), kind: reactionKindValidator },
  handler: async (ctx, { token, secret, reelId, kind }) => {
    const { study, guest } = await requireGuest(ctx, token, secret);
    const reel = await requireShareReel(ctx, study, reelId);
    const existing = await ctx.db
      .query("guestReactions")
      .withIndex("by_reel_and_guest", (q) => q.eq("reelId", reelId).eq("guestId", guest._id))
      .unique();
    if (existing?.kind === kind) {
      await ctx.db.delete("guestReactions", existing._id);
      await bumpCounter(ctx, reel, { [REACTION_FIELD[kind]]: -1 });
      return null;
    }
    if (existing) {
      await ctx.db.patch("guestReactions", existing._id, { kind });
      await bumpCounter(ctx, reel, { [REACTION_FIELD[existing.kind]]: -1, [REACTION_FIELD[kind]]: 1 });
      await notifyReaction(ctx, reel, { guestName: guest.name }, kind);
      return kind;
    }
    await ctx.db.insert("guestReactions", { reelId, studyId: study._id, guestId: guest._id, kind });
    await bumpCounter(ctx, reel, { [REACTION_FIELD[kind]]: 1 });
    await notifyReaction(ctx, reel, { guestName: guest.name }, kind);
    return kind;
  },
});

/** Views from people who haven't named themselves only bump the total view count. */
export const recordView = mutation({
  args: { token: v.string(), secret: v.optional(v.string()), reelId: v.id("reels"), completed: v.boolean() },
  handler: async (ctx, { token, secret, reelId, completed }) => {
    const { study, link } = await requireShare(ctx, token);
    const reel = await requireShareReel(ctx, study, reelId);
    const guest = await findGuest(ctx, study._id, secret);
    if (!guest) {
      // Unnamed views are capped per link so reloading can't inflate the numbers.
      if (!completed && (await tryConsume(ctx, "anonView", link._id))) {
        await bumpCounter(ctx, reel, { views: 1 });
      }
      return null;
    }
    const existing = await ctx.db
      .query("guestViews")
      .withIndex("by_reel_and_guest", (q) => q.eq("reelId", reelId).eq("guestId", guest._id))
      .unique();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    if (!existing) {
      await ctx.db.insert("guestViews", {
        reelId,
        studyId: study._id,
        guestId: guest._id,
        viewCount: 1,
        completed,
        lastViewedAt: now,
      });
      await bumpCounter(ctx, reel, { views: 1, viewers: 1, completions: completed ? 1 : 0 });
      return null;
    }
    if (completed) {
      if (!existing.completed) {
        await ctx.db.patch("guestViews", existing._id, { completed: true });
        await bumpCounter(ctx, reel, { completions: 1 });
      }
      return null;
    }
    if (!countsAsNewView(existing.lastViewedAt, nowDate)) return null;
    await ctx.db.patch("guestViews", existing._id, { viewCount: existing.viewCount + 1, lastViewedAt: now });
    await bumpCounter(ctx, reel, { views: 1 });
    return null;
  },
});

export const addComment = mutation({
  args: {
    token: v.string(),
    secret: v.string(),
    reelId: v.id("reels"),
    kind: commentKindValidator,
    body: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const { study, guest } = await requireGuest(ctx, args.token, args.secret);
    const reel = await requireShareReel(ctx, study, args.reelId);
    await enforceLimit(ctx, "guestComment", guest._id);
    await insertComment(ctx, reel, { guestId: guest._id }, args);
    await notifyComment(ctx, reel, { guestName: guest.name }, args);
    return null;
  },
});

export const deleteComment = mutation({
  args: { token: v.string(), secret: v.string(), commentId: v.id("comments") },
  handler: async (ctx, { token, secret, commentId }) => {
    const { study, guest } = await requireGuest(ctx, token, secret);
    const comment = await ctx.db.get("comments", commentId);
    if (!comment) return null;
    if (comment.guestId !== guest._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only delete your own comments" });
    }
    const reel = await requireShareReel(ctx, study, comment.reelId);
    await removeComment(ctx, reel, comment);
    return null;
  },
});
