import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/** A live share link and its published study, or null if revoked/unpublished. */
export async function loadShare(
  ctx: Ctx,
  token: string,
): Promise<{ link: Doc<"shareLinks">; study: Doc<"studies"> } | null> {
  const link = await ctx.db
    .query("shareLinks")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!link || link.revoked) return null;
  const study = await ctx.db.get("studies", link.studyId);
  if (!study || study.status !== "published") return null;
  return { link, study };
}

export async function requireShare(ctx: Ctx, token: string) {
  const share = await loadShare(ctx, token);
  if (!share) {
    throw new ConvexError({ code: "NOT_FOUND", message: "This link is no longer available" });
  }
  return share;
}

/** Finds the guest for a secret, scoped to this study. */
export async function findGuest(
  ctx: Ctx,
  studyId: Id<"studies">,
  secret: string | undefined,
): Promise<Doc<"guests"> | null> {
  if (!secret) return null;
  const guest = await ctx.db
    .query("guests")
    .withIndex("by_secret", (q) => q.eq("secret", secret))
    .unique();
  return guest && guest.studyId === studyId ? guest : null;
}

export async function requireGuest(ctx: Ctx, token: string, secret: string) {
  const share = await requireShare(ctx, token);
  const guest = await findGuest(ctx, share.study._id, secret);
  if (!guest) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Tell us your name to join in" });
  }
  return { ...share, guest };
}

/** A reel that belongs to the shared study and is visible in its feed. */
export async function requireShareReel(
  ctx: Ctx,
  study: Doc<"studies">,
  reelId: Id<"reels">,
): Promise<Doc<"reels">> {
  const reel = await ctx.db.get("reels", reelId);
  if (!reel || reel.studyId !== study._id || !reel.enabled) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Scene not found" });
  }
  return reel;
}
