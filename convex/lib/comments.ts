import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { CommentKind } from "../schema/validators";
import { bumpCounter } from "./counters";

export type Author = { name: string; avatar?: string; isGuest: boolean };
export type CommentAuthorRef =
  | { userId: Id<"users">; guestId?: undefined }
  | { guestId: Id<"guests">; userId?: undefined };

/** Resolves display names for members and share-link guests, one read per author. */
export async function resolveAuthors(
  ctx: QueryCtx,
  rows: Doc<"comments">[],
): Promise<Map<string, Author>> {
  const authors = new Map<string, Author>();
  for (const r of rows) {
    if (r.userId && !authors.has(r.userId)) {
      const u = await ctx.db.get("users", r.userId);
      authors.set(r.userId, { name: u?.name ?? u?.email ?? "Someone", avatar: u?.avatar, isGuest: false });
    } else if (r.guestId && !authors.has(r.guestId)) {
      const g = await ctx.db.get("guests", r.guestId);
      authors.set(r.guestId, { name: g?.name ?? "Guest", isGuest: true });
    }
  }
  return authors;
}

export function authorKey(c: Doc<"comments">): string {
  return c.userId ?? c.guestId ?? "";
}

export async function listComments(
  ctx: QueryCtx,
  reelId: Id<"reels">,
  viewer: {
    userId?: Id<"users">;
    guestId?: Id<"guests">;
    canModerate?: boolean;
    // Guests never see teammates' photos, and may not see team comments at all.
    guestView?: { hideTeam: boolean };
  },
  canResolveAny: boolean,
) {
  const all = await ctx.db
    .query("comments")
    .withIndex("by_reel", (q) => q.eq("reelId", reelId))
    .take(300);
  const rows = viewer.guestView?.hideTeam ? all.filter((r) => r.userId === undefined) : all;
  const authors = await resolveAuthors(ctx, rows);
  return rows.map((r) => {
    const isMine =
      (viewer.userId !== undefined && r.userId === viewer.userId) ||
      (viewer.guestId !== undefined && r.guestId === viewer.guestId);
    const author = authors.get(authorKey(r)) ?? { name: "Someone", isGuest: false };
    return {
      _id: r._id,
      _creationTime: r._creationTime,
      parentId: r.parentId ?? null,
      kind: r.kind,
      body: r.body,
      resolved: r.resolved,
      author: viewer.guestView ? { name: author.name, isGuest: author.isGuest } : author,
      isMine,
      canDelete: isMine || viewer.canModerate === true,
      // Guests can't resolve; members resolve their own, editors resolve any.
      canResolve:
        r.kind !== "note" &&
        viewer.userId !== undefined &&
        (canResolveAny || r.userId === viewer.userId),
    };
  });
}

export async function insertComment(
  ctx: MutationCtx,
  reel: Doc<"reels">,
  author: CommentAuthorRef,
  args: { kind: CommentKind; body: string; parentId?: Id<"comments"> },
): Promise<void> {
  const body = args.body.trim();
  if (!body) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Write something first" });
  }
  if (body.length > 2000) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Keep it under 2,000 characters" });
  }
  if (args.parentId) {
    const parent = await ctx.db.get("comments", args.parentId);
    if (!parent || parent.reelId !== reel._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That comment was removed" });
    }
  }
  await ctx.db.insert("comments", {
    reelId: reel._id,
    studyId: reel.studyId,
    ...author,
    parentId: args.parentId,
    kind: args.kind,
    body,
    resolved: false,
  });
  await bumpCounter(ctx, reel, {
    commentCount: 1,
    openCount: args.kind === "note" ? 0 : 1,
    ...(author.guestId ? { guestCommentCount: 1, guestOpenCount: args.kind === "note" ? 0 : 1 } : {}),
  });
}

export async function removeComment(
  ctx: MutationCtx,
  reel: Doc<"reels">,
  comment: Doc<"comments">,
): Promise<void> {
  await ctx.db.delete("comments", comment._id);
  const openDelta = comment.kind !== "note" && !comment.resolved ? -1 : 0;
  await bumpCounter(ctx, reel, {
    commentCount: -1,
    openCount: openDelta,
    ...(comment.guestId ? { guestCommentCount: -1, guestOpenCount: openDelta } : {}),
  });
}
