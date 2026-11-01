import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { effectiveRole, getMembership, getUser, hasRole, isSeatRestricted, requireRole, requireUser } from "./lib/access";
import { randomToken } from "./lib/random";
import { inviteRoleValidator, planValidator, roleValidator, type Plan, type Role } from "./schema/validators";
import { assertEditorSeat } from "./billing/limits";
import { onEditorsChanged } from "./billing/data";
import { enforceLimit } from "./lib/rateLimit";

const MAX_INVITE_USES = 500;

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return [];
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50);
    const result = await Promise.all(
      memberships.map(async (m) => {
        const ws = await ctx.db.get("workspaces", m.workspaceId);
        // Editors paused by a plan seat limit use the app as members until the workspace upgrades.
        return ws ? { _id: ws._id, name: ws.name, role: effectiveRole(ws, m.role), seatPaused: isSeatRestricted(ws, m.role) } : null;
      }),
    );
    return result.filter((w) => w !== null);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<Id<"workspaces">> => {
    const user = await requireUser(ctx);
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Workspace name must be 2–60 characters",
      });
    }
    await enforceLimit(ctx, "createWorkspace", user._id);
    const workspaceId = await ctx.db.insert("workspaces", {
      name: trimmed,
      createdBy: user._id,
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: user._id,
      role: "owner",
    });
    // Every workspace is a billable customer; create it in the background.
    await ctx.scheduler.runAfter(0, internal.billing.actions.createCustomer, { workspaceId });
    return workspaceId;
  },
});

export const rename = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, { workspaceId, name }) => {
    await requireRole(ctx, workspaceId, "owner");
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Workspace name must be 2–60 characters",
      });
    }
    await ctx.db.patch("workspaces", workspaceId, { name: trimmed });
    return null;
  },
});

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { membership } = await requireRole(ctx, workspaceId, "member");
    const ws = await ctx.db.get("workspaces", workspaceId);
    if (!ws) return null;
    // `membership.role` is already the effective role after seat pauses.
    return { _id: ws._id, name: ws.name, role: membership.role };
  },
});

export const members = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { user, membership } = await requireRole(ctx, workspaceId, "member");
    // Email addresses are only shown to people who manage the team.
    const canSeeEmails = hasRole(membership.role, "editor");
    const rows = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(500);
    return await Promise.all(
      rows.map(async (m) => {
        const u = await ctx.db.get("users", m.userId);
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          isMe: m.userId === user._id,
          name: u?.name ?? (canSeeEmails ? u?.email : undefined) ?? "Teammate",
          email: canSeeEmails ? u?.email : undefined,
          avatar: u?.avatar,
        };
      }),
    );
  },
});

async function ownerCount(
  ctx: Parameters<typeof requireRole>[0],
  workspaceId: Id<"workspaces">,
): Promise<number> {
  const owners = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_and_role", (q) =>
      q.eq("workspaceId", workspaceId).eq("role", "owner"),
    )
    .take(2);
  return owners.length;
}

const isEditorRole = (role: Role) => hasRole(role, "editor");

async function changeMemberRole(
  ctx: MutationCtx,
  memberId: Id<"workspaceMembers">,
  role: Role,
  plan: Plan,
): Promise<null> {
  const target = await ctx.db.get("workspaceMembers", memberId);
  if (!target) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
  }
  await requireRole(ctx, target.workspaceId, "owner");
  if (
    target.role === "owner" &&
    role !== "owner" &&
    (await ownerCount(ctx, target.workspaceId)) < 2
  ) {
    throw new ConvexError({
      code: "CONFLICT",
      message: "A workspace needs at least one owner. Promote someone else first.",
    });
  }
  // Promoting a viewer into an editor seat is what the plan limits.
  if (!isEditorRole(target.role) && isEditorRole(role)) {
    await assertEditorSeat(ctx, target.workspaceId, plan);
  }
  await ctx.db.patch("workspaceMembers", memberId, { role });
  if (isEditorRole(target.role) !== isEditorRole(role)) await onEditorsChanged(ctx, target.workspaceId);
  return null;
}

/** Free-plan path. Paid workspaces go through `billing.actions.setMemberRole`. */
export const setMemberRole = mutation({
  args: { memberId: v.id("workspaceMembers"), role: roleValidator },
  handler: async (ctx, { memberId, role }) => changeMemberRole(ctx, memberId, role, "free"),
});

export const setMemberRoleWithPlan = internalMutation({
  args: { memberId: v.id("workspaceMembers"), role: roleValidator, plan: planValidator },
  handler: async (ctx, { memberId, role, plan }) => changeMemberRole(ctx, memberId, role, plan),
});

export const memberWorkspace = internalQuery({
  args: { memberId: v.id("workspaceMembers") },
  handler: async (ctx, { memberId }) => {
    const m = await ctx.db.get("workspaceMembers", memberId);
    if (!m) return null;
    const ws = await ctx.db.get("workspaces", m.workspaceId);
    return ws ? { customerId: ws.customerId ?? null } : null;
  },
});

export const removeMember = mutation({
  args: { memberId: v.id("workspaceMembers") },
  handler: async (ctx, { memberId }) => {
    const target = await ctx.db.get("workspaceMembers", memberId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    }
    const user = await requireUser(ctx);
    // Anyone may leave; only owners may remove others.
    if (target.userId !== user._id) {
      await requireRole(ctx, target.workspaceId, "owner");
    }
    if (
      target.role === "owner" &&
      (await ownerCount(ctx, target.workspaceId)) < 2
    ) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "A workspace can't lose its last owner.",
      });
    }
    await ctx.db.delete("workspaceMembers", memberId);
    if (target.userId !== user._id) await blockRejoin(ctx, target.workspaceId, target.userId);
    if (isEditorRole(target.role)) await onEditorsChanged(ctx, target.workspaceId);
    return null;
  },
});

/**
 * Remembers that an owner removed this person, so old invite links can't bring
 * them back, and turns off any invite links they created.
 */
async function blockRejoin(ctx: MutationCtx, workspaceId: Id<"workspaces">, userId: Id<"users">): Promise<void> {
  const prior = await findRemoval(ctx, workspaceId, userId);
  if (prior) await ctx.db.delete("workspaceRemovals", prior._id);
  await ctx.db.insert("workspaceRemovals", { workspaceId, userId });
  const theirInvites = await ctx.db
    .query("workspaceInvites")
    .withIndex("by_workspace_and_creator", (q) => q.eq("workspaceId", workspaceId).eq("createdBy", userId))
    .take(200);
  for (const inv of theirInvites) {
    if (!inv.revoked) await ctx.db.patch("workspaceInvites", inv._id, { revoked: true });
  }
}

async function findRemoval(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">, userId: Id<"users">) {
  return await ctx.db
    .query("workspaceRemovals")
    .withIndex("by_workspace_and_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .unique();
}

/**
 * A removed person may only come back through an invite an owner created after
 * the removal. Returns the removal record (to clear on rejoin), or null if none.
 */
async function assertMayRejoin(
  ctx: QueryCtx | MutationCtx,
  invite: Doc<"workspaceInvites">,
  userId: Id<"users">,
): Promise<Doc<"workspaceRemovals"> | null> {
  const removal = await findRemoval(ctx, invite.workspaceId, userId);
  if (!removal) return null;
  const creator = await getMembership(ctx, invite.workspaceId, invite.createdBy);
  if (invite._creationTime > removal._creationTime && creator?.role === "owner") return removal;
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "You were removed from this workspace. Ask an owner for a new invite.",
  });
}

// ---------- Invites ----------


const inviteArgs = {
  workspaceId: v.id("workspaces"),
  role: inviteRoleValidator,
  expiresInDays: v.number(),
  maxUses: v.optional(v.number()),
};

async function insertInvite(
  ctx: MutationCtx,
  args: { workspaceId: Id<"workspaces">; role: "editor" | "member"; expiresInDays: number; maxUses?: number },
  plan: Plan,
): Promise<string> {
  const { workspaceId, role, expiresInDays } = args;
  // Editor seats can cost money, so only owners hand out editor invites.
  const { user } = await requireRole(ctx, workspaceId, role === "editor" ? "owner" : "editor");
  if (expiresInDays < 1 || expiresInDays > 30) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Expiry must be 1–30 days",
    });
  }
  const maxUses = Math.floor(args.maxUses ?? MAX_INVITE_USES);
  if (maxUses < 1 || maxUses > MAX_INVITE_USES) {
    throw new ConvexError({ code: "BAD_REQUEST", message: `Invites can be used 1–${MAX_INVITE_USES} times` });
  }
  if (role === "editor") await assertEditorSeat(ctx, workspaceId, plan);
  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + expiresInDays * 86_400_000,
  ).toISOString();
  await ctx.db.insert("workspaceInvites", {
    workspaceId,
    token,
    role,
    expiresAt,
    createdBy: user._id,
    revoked: false,
    uses: 0,
    maxUses,
  });
  return token;
}

/** Free-plan path. Paid workspaces go through `billing.actions.createInvite`. */
export const createInvite = mutation({
  args: inviteArgs,
  handler: async (ctx, args) => insertInvite(ctx, args, "free"),
});

export const createInviteWithPlan = internalMutation({
  args: { ...inviteArgs, plan: planValidator },
  handler: async (ctx, { plan, ...args }) => insertInvite(ctx, args, plan),
});

export const listInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireRole(ctx, workspaceId, "editor");
    const rows = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(30);
    const now = new Date().toISOString();
    return rows
      .filter((r) => !r.revoked && r.expiresAt > now && !isUsedUp(r))
      .map((r) => ({
        _id: r._id,
        token: r.token,
        role: r.role,
        expiresAt: r.expiresAt,
        uses: r.uses,
        maxUses: r.maxUses ?? null,
      }));
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get("workspaceInvites", inviteId);
    if (!invite) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invite not found" });
    }
    await requireRole(ctx, invite.workspaceId, "editor");
    await ctx.db.patch("workspaceInvites", inviteId, { revoked: true });
    return null;
  },
});

function isUsedUp(invite: Doc<"workspaceInvites">): boolean {
  return invite.maxUses !== undefined && invite.uses >= invite.maxUses;
}

/** Public: shows the workspace name for an invite link, without signing in. */
export const peekInvite = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.revoked) return { status: "invalid" as const };
    if (invite.expiresAt < new Date().toISOString()) {
      return { status: "expired" as const };
    }
    const ws = await ctx.db.get("workspaces", invite.workspaceId);
    if (!ws) return { status: "invalid" as const };
    const user = await getUser(ctx);
    let alreadyMember = false;
    if (user) {
      const m = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_and_user", (q) =>
          q.eq("workspaceId", ws._id).eq("userId", user._id),
        )
        .unique();
      alreadyMember = m !== null;
      if (!alreadyMember) {
        try {
          await assertMayRejoin(ctx, invite, user._id);
        } catch {
          return { status: "invalid" as const };
        }
      }
    }
    if (!alreadyMember && isUsedUp(invite)) return { status: "expired" as const };
    return {
      status: "valid" as const,
      workspaceId: ws._id,
      workspaceName: ws.name,
      role: invite.role,
      alreadyMember,
    };
  },
});

async function joinWithInvite(
  ctx: MutationCtx,
  token: string,
  plan: Plan,
): Promise<Id<"workspaces">> {
  const user = await requireUser(ctx);
  const invite = await ctx.db
    .query("workspaceInvites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!invite || invite.revoked) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "This invite link is no longer valid",
    });
  }
  if (invite.expiresAt < new Date().toISOString()) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "This invite link has expired. Ask for a new one.",
    });
  }
  const existing = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_and_user", (q) =>
      q.eq("workspaceId", invite.workspaceId).eq("userId", user._id),
    )
    .unique();
  if (!existing) {
    const removal = await assertMayRejoin(ctx, invite, user._id);
    if (isUsedUp(invite)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "This invite link has been used up. Ask for a new one.",
      });
    }
    if (invite.role === "editor") {
      await assertEditorSeat(ctx, invite.workspaceId, plan);
    }
    await ctx.db.insert("workspaceMembers", {
      workspaceId: invite.workspaceId,
      userId: user._id,
      role: invite.role,
    });
    await ctx.db.patch("workspaceInvites", invite._id, {
      uses: invite.uses + 1,
    });
    if (removal) await ctx.db.delete("workspaceRemovals", removal._id);
    if (invite.role === "editor") await onEditorsChanged(ctx, invite.workspaceId);
  }
  return invite.workspaceId;
}

/** Free-plan path. Paid workspaces go through `billing.actions.acceptInvite`. */
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<Id<"workspaces">> => joinWithInvite(ctx, token, "free"),
});

export const acceptInviteWithPlan = internalMutation({
  args: { token: v.string(), plan: planValidator },
  handler: async (ctx, { token, plan }): Promise<Id<"workspaces">> => joinWithInvite(ctx, token, plan),
});

export const inviteWorkspace = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite) return null;
    const ws = await ctx.db.get("workspaces", invite.workspaceId);
    return ws ? { customerId: ws.customerId ?? null } : null;
  },
});
