import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "../schema/validators";

const ROLE_RANK: Record<Role, number> = { member: 1, editor: 2, owner: 3 };

export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export async function getUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in" });
  }
  const user = await getUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Your profile is not set up yet. Try signing in again.",
    });
  }
  return user;
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
): Promise<Doc<"workspaceMembers"> | null> {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_and_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .unique();
}

/**
 * True when the workspace has more editors than its plan allows (after a
 * downgrade or lapsed payment). Owners keep editing; other editors are
 * treated as members until the workspace upgrades. Nobody is removed.
 */
export function isSeatRestricted(ws: Doc<"workspaces"> | null, role: Role): boolean {
  return Boolean(ws?.seatOverage) && role === "editor";
}

/** The role a member effectively has right now, after plan seat limits. */
export function effectiveRole(ws: Doc<"workspaces"> | null, role: Role): Role {
  return isSeatRestricted(ws, role) ? "member" : role;
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  min: Role,
): Promise<{ user: Doc<"users">; membership: Doc<"workspaceMembers"> }> {
  const user = await requireUser(ctx);
  const stored = await getMembership(ctx, workspaceId, user._id);
  if (!stored || !hasRole(stored.role, min)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message:
        min === "member"
          ? "You are not a member of this workspace"
          : `Only workspace ${min}s can do this`,
    });
  }
  const membership = await withEffectiveRole(ctx, stored);
  if (!hasRole(membership.role, min)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Editing is paused because this workspace's plan has fewer editor seats than editors. Ask an owner to upgrade to Team.",
    });
  }
  // The returned role is the effective one, so every caller's checks respect seat pauses.
  return { user, membership };
}

/** A membership with its role lowered to what plan seat limits currently allow. */
export async function withEffectiveRole(
  ctx: QueryCtx | MutationCtx,
  membership: Doc<"workspaceMembers">,
): Promise<Doc<"workspaceMembers">> {
  if (membership.role !== "editor") return membership;
  const ws = await ctx.db.get("workspaces", membership.workspaceId);
  return { ...membership, role: effectiveRole(ws, membership.role) };
}

/** Members can only see published studies; editors see everything. */
export function canSeeStudy(study: Doc<"studies">, role: Role): boolean {
  return hasRole(role, "editor") || study.status === "published";
}

export async function requireStudy(
  ctx: QueryCtx | MutationCtx,
  studyId: Id<"studies">,
  min: Role,
): Promise<{
  user: Doc<"users">;
  membership: Doc<"workspaceMembers">;
  study: Doc<"studies">;
}> {
  const study = await ctx.db.get("studies", studyId);
  if (!study) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Study not found" });
  }
  const { user, membership } = await requireRole(ctx, study.workspaceId, min);
  if (!canSeeStudy(study, membership.role)) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Study not found" });
  }
  return { user, membership, study };
}

export async function requireReel(
  ctx: QueryCtx | MutationCtx,
  reelId: Id<"reels">,
  min: Role,
): Promise<{
  user: Doc<"users">;
  membership: Doc<"workspaceMembers">;
  study: Doc<"studies">;
  reel: Doc<"reels">;
}> {
  const reel = await ctx.db.get("reels", reelId);
  if (!reel) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Scene not found" });
  }
  const access = await requireStudy(ctx, reel.studyId, min);
  // Scenes an editor turned off (or that failed verification) stay hidden from members.
  if (!reel.enabled && !hasRole(access.membership.role, "editor")) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Scene not found" });
  }
  return { ...access, reel };
}
