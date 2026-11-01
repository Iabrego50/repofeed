import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireRole } from "../lib/access";
import { planValidator, roleValidator } from "../schema/validators";
import { EDITOR_LIMIT, VARIANTS, countActiveStudies, countEditors, teamSeats, variantInterval } from "./limits";

const MAX_EDITORS = 500;

const isTeamVariant = (id: string | undefined) => id === VARIANTS.team.month || id === VARIANTS.team.year;

/** Billing details for a workspace, after checking the caller's role. */
export const billingInfo = internalQuery({
  args: { workspaceId: v.id("workspaces"), minRole: roleValidator },
  handler: async (ctx, { workspaceId, minRole }) => {
    const { user } = await requireRole(ctx, workspaceId, minRole);
    const ws = await ctx.db.get("workspaces", workspaceId);
    if (!ws) return null;
    const editors = await countEditors(ctx, workspaceId, MAX_EDITORS);
    return {
      workspaceName: ws.name,
      customerId: ws.customerId ?? null,
      email: user.email ?? null,
      userId: user._id,
      trialUsed: user.trialUsedAt !== undefined,
      editors,
    };
  },
});

/**
 * Records what a live plan check found. Only writes when something changed,
 * since plan checks run on every page focus.
 */
export const syncPlan = internalMutation({
  args: { workspaceId: v.id("workspaces"), plan: planValidator },
  handler: async (ctx, { workspaceId, plan }): Promise<null> => {
    const ws = await ctx.db.get("workspaces", workspaceId);
    if (!ws) return null;
    const editors = await countEditors(ctx, workspaceId, MAX_EDITORS);
    const paid = plan === "free" ? undefined : plan;
    const next = {
      paidPlan: paid,
      // A paid plan that disappeared means it was cancelled or a renewal payment failed.
      lapsedPlan: paid ? undefined : (ws.paidPlan ?? ws.lapsedPlan),
      seatOverage: editors > EDITOR_LIMIT[plan] ? true : undefined,
    };
    if (next.paidPlan !== ws.paidPlan || next.lapsedPlan !== ws.lapsedPlan || next.seatOverage !== ws.seatOverage) {
      await ctx.db.patch("workspaces", workspaceId, next);
    }
    // Whoever started the paid plan has now used their one free trial.
    if (paid && ws.checkoutBy) {
      const buyer = await ctx.db.get("users", ws.checkoutBy);
      if (buyer && !buyer.trialUsedAt) await ctx.db.patch("users", buyer._id, { trialUsedAt: new Date().toISOString() });
    }
    // Retry a seat update that failed earlier.
    if (plan === "team" && isTeamVariant(ws.seatVariant) && ws.seats !== teamSeats(editors)) {
      await ctx.scheduler.runAfter(0, internal.billing.actions.syncSeats, { workspaceId });
    }
    return null;
  },
});

export const recordCheckout = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    variantId: v.string(),
    seats: v.number(),
    returnUrl: v.string(),
  },
  handler: async (ctx, { workspaceId, userId, variantId, seats, returnUrl }): Promise<null> => {
    await ctx.db.patch("workspaces", workspaceId, {
      seatVariant: variantId,
      seats,
      billingReturnUrl: returnUrl,
      checkoutBy: userId,
    });
    return null;
  },
});

export const seatInfo = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const ws = await ctx.db.get("workspaces", workspaceId);
    if (!ws) return null;
    return {
      customerId: ws.customerId ?? null,
      seatVariant: ws.seatVariant ?? null,
      seats: ws.seats ?? null,
      returnUrl: ws.billingReturnUrl ?? null,
      editors: await countEditors(ctx, workspaceId, MAX_EDITORS),
    };
  },
});

export const recordSeats = internalMutation({
  args: { workspaceId: v.id("workspaces"), seats: v.number() },
  handler: async (ctx, { workspaceId, seats }): Promise<null> => {
    await ctx.db.patch("workspaces", workspaceId, { seats });
    return null;
  },
});

/**
 * Call after editors are added or removed. Clears the seat-overage pause when
 * the workspace is back within its limit, and updates the Team seat count.
 */
export async function onEditorsChanged(ctx: MutationCtx, workspaceId: Id<"workspaces">): Promise<void> {
  const ws = await ctx.db.get("workspaces", workspaceId);
  if (!ws) return;
  if (ws.seatOverage) {
    const limit = EDITOR_LIMIT[ws.paidPlan ?? "free"];
    if ((await countEditors(ctx, workspaceId, limit + 1)) <= limit) {
      await ctx.db.patch("workspaces", workspaceId, { seatOverage: undefined });
    }
  }
  if (ws.paidPlan === "team" && isTeamVariant(ws.seatVariant)) {
    await ctx.scheduler.runAfter(0, internal.billing.actions.syncSeats, { workspaceId });
  }
}

/** Unauthenticated lookup used by the background customer-creation job. */
export const workspaceForCustomer = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const ws = await ctx.db.get("workspaces", workspaceId);
    if (!ws) return null;
    const owner = await ctx.db.get("users", ws.createdBy);
    return { name: ws.name, customerId: ws.customerId ?? null, email: owner?.email ?? null };
  },
});

/** Saves the customer id only if none is set yet, so racing creators agree on one. */
export const setCustomerId = internalMutation({
  args: { workspaceId: v.id("workspaces"), customerId: v.string() },
  handler: async (ctx, { workspaceId, customerId }): Promise<string> => {
    const ws = await ctx.db.get("workspaces", workspaceId);
    if (!ws) return customerId;
    if (ws.customerId) return ws.customerId;
    await ctx.db.patch("workspaces", workspaceId, { customerId });
    return customerId;
  },
});

/** The workspace a study belongs to (callers still check access). */
export const studyWorkspace = internalQuery({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => (await ctx.db.get("studies", studyId))?.workspaceId ?? null,
});

export const usage = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { user } = await requireRole(ctx, workspaceId, "member");
    const ws = await ctx.db.get("workspaces", workspaceId);
    return {
      studies: await countActiveStudies(ctx, workspaceId, 100),
      editors: await countEditors(ctx, workspaceId, 100),
      // Seats currently billed on Team, and whether it's billed monthly or yearly.
      seats: ws?.seats ?? null,
      interval: variantInterval(ws?.seatVariant),
      lapsedPlan: ws?.lapsedPlan ?? null,
      seatOverage: ws?.seatOverage ?? false,
      trialUsed: user.trialUsedAt !== undefined,
    };
  },
});

/** Owner dismisses the "your plan ended" notice. */
export const dismissLapse = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<null> => {
    await requireRole(ctx, workspaceId, "owner");
    await ctx.db.patch("workspaces", workspaceId, { lapsedPlan: undefined });
    return null;
  },
});
