"use node";

import { ConvexError, v } from "convex/values";
import { Hercules } from "@usehercules/sdk";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { inviteRoleValidator, roleValidator, type Plan } from "../schema/validators";
import { FEATURE_PRO, FEATURE_TEAM, TRIAL_DAYS, VARIANTS, assertPaid, teamSeats } from "./limits";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY,
  apiVersion: "2025-12-09",
});

/** Always asks Commerce at runtime; plans are never stored locally. */
async function resolvePlan(customerId: string | null): Promise<Plan> {
  if (!customerId) return "free";
  try {
    const team = await hercules.commerce.check({ customer_id: customerId, resource_id: FEATURE_TEAM });
    if (team.has_access) return "team";
    const pro = await hercules.commerce.check({ customer_id: customerId, resource_id: FEATURE_PRO });
    return pro.has_access ? "pro" : "free";
  } catch (err) {
    // Keep provider details in the logs, not in front of users.
    console.error("Plan check failed", err);
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Couldn't check your plan. Try again in a moment.",
    });
  }
}

type PlanInfo = { plan: Plan; editors: number; customerId: string | null; trialUsed: boolean; userId: Id<"users"> };

/** Checks the caller's role, asks Commerce for the plan, and refreshes the workspace's billing hints. */
async function planFor(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">,
  minRole: "member" | "editor" | "owner",
): Promise<PlanInfo> {
  const info = await ctx.runQuery(internal.billing.data.billingInfo, { workspaceId, minRole });
  if (!info) throw new ConvexError({ code: "NOT_FOUND", message: "Workspace not found" });
  const plan = await resolvePlan(info.customerId);
  await ctx.runMutation(internal.billing.data.syncPlan, { workspaceId, plan });
  return { plan, editors: info.editors, customerId: info.customerId, trialUsed: info.trialUsed, userId: info.userId };
}

async function ensureCustomer(ctx: ActionCtx, workspaceId: Id<"workspaces">): Promise<string> {
  const ws = await ctx.runQuery(internal.billing.data.workspaceForCustomer, { workspaceId });
  if (!ws) throw new ConvexError({ code: "NOT_FOUND", message: "Workspace not found" });
  if (ws.customerId) return ws.customerId;
  const customer = await hercules.commerce.customers.create({
    name: ws.name,
    ...(ws.email ? { email: ws.email } : {}),
  });
  return await ctx.runMutation(internal.billing.data.setCustomerId, { workspaceId, customerId: customer.id });
}

/** Scheduled right after a workspace is created. */
export const createCustomer = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<null> => {
    await ensureCustomer(ctx, workspaceId);
    return null;
  },
});

export const getPlan = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<{ plan: Plan }> => {
    const { plan } = await planFor(ctx, workspaceId, "member");
    return { plan };
  },
});

export const checkout = action({
  args: {
    workspaceId: v.id("workspaces"),
    plan: v.union(v.literal("pro"), v.literal("team")),
    interval: v.union(v.literal("month"), v.literal("year")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string | null; updated: boolean }> => {
    const { editors, trialUsed, userId } = await planFor(ctx, args.workspaceId, "owner");
    const customerId = await ensureCustomer(ctx, args.workspaceId);
    // Team is billed per editor seat; Pro is a single seat.
    const quantity = args.plan === "team" ? teamSeats(editors) : 1;
    const variantId = VARIANTS[args.plan][args.interval];
    const session = await hercules.commerce.checkout({
      customer_id: customerId,
      line_items: [{ variant_id: variantId, quantity }],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      // One free trial per person, however many workspaces they create.
      trial_period_days: trialUsed ? 0 : TRIAL_DAYS,
      // Upgrades of an existing plan: charge the prorated difference right away,
      // which is what the confirmation dialog tells the owner.
      proration_behavior: "prorate",
      charge_timing: "immediate",
    });
    await ctx.runMutation(internal.billing.data.recordCheckout, {
      workspaceId: args.workspaceId,
      userId,
      variantId,
      seats: quantity,
      returnUrl: args.cancelUrl,
    });
    return { url: session.url ?? null, updated: session.action === "update" };
  },
});

export const billingPortal = action({
  args: { workspaceId: v.id("workspaces"), returnUrl: v.string() },
  handler: async (ctx, { workspaceId, returnUrl }): Promise<{ url: string }> => {
    await planFor(ctx, workspaceId, "owner");
    const customerId = await ensureCustomer(ctx, workspaceId);
    const portal = await hercules.commerce.customers.billingPortal(customerId, { return_url: returnUrl });
    return { url: portal.url };
  },
});

/**
 * Keeps the Team seat count equal to the number of editors (minimum 2).
 * Scheduled whenever editors are added or removed.
 */
export const syncSeats = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<null> => {
    const info = await ctx.runQuery(internal.billing.data.seatInfo, { workspaceId });
    if (!info?.customerId || !info.seatVariant || !info.returnUrl) return null;
    const isTeamVariant = info.seatVariant === VARIANTS.team.month || info.seatVariant === VARIANTS.team.year;
    if (!isTeamVariant) return null;
    const seats = teamSeats(info.editors);
    if (seats === info.seats) return null;
    try {
      if ((await resolvePlan(info.customerId)) !== "team") return null;
      await hercules.commerce.checkout({
        customer_id: info.customerId,
        line_items: [{ variant_id: info.seatVariant, quantity: seats }],
        success_url: info.returnUrl,
        proration_behavior: "prorate",
        charge_timing: "immediate",
      });
      await ctx.runMutation(internal.billing.data.recordSeats, { workspaceId, seats });
    } catch (err) {
      // Retried on the next plan check (any page load in the workspace).
      console.error("Seat update failed", workspaceId, err);
    }
    return null;
  },
});

// ---------- Plan-gated writes ----------

/** Throws unless the caller is an editor of a workspace on Pro or Team. */
export const requirePaid = internalAction({
  args: { workspaceId: v.id("workspaces"), feature: v.string() },
  handler: async (ctx, { workspaceId, feature }): Promise<null> => {
    const { plan } = await planFor(ctx, workspaceId, "editor");
    assertPaid(plan, feature);
    return null;
  },
});

/** Used by background jobs (no signed-in user). Treats a failed check as Free. */
export const isPaid = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<boolean> => {
    const ws = await ctx.runQuery(internal.billing.data.workspaceForCustomer, { workspaceId });
    try {
      return (await resolvePlan(ws?.customerId ?? null)) !== "free";
    } catch {
      return false;
    }
  },
});

export const createStudy = action({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    audience: v.string(),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"studies">> => {
    const { plan } = await planFor(ctx, args.workspaceId, "editor");
    return await ctx.runMutation(internal.studies.createWithPlan, { ...args, plan });
  },
});

export const restoreStudy = action({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<null> => {
    const workspaceId = await ctx.runQuery(internal.billing.data.studyWorkspace, { studyId });
    if (!workspaceId) throw new ConvexError({ code: "NOT_FOUND", message: "Study not found" });
    const { plan } = await planFor(ctx, workspaceId, "editor");
    return await ctx.runMutation(internal.studies.restoreWithPlan, { studyId, plan });
  },
});

export const createInvite = action({
  args: { workspaceId: v.id("workspaces"), role: inviteRoleValidator, expiresInDays: v.number(), maxUses: v.optional(v.number()) },
  handler: async (ctx, args): Promise<string> => {
    const { plan } = await planFor(ctx, args.workspaceId, "editor");
    return await ctx.runMutation(internal.workspaces.createInviteWithPlan, { ...args, plan });
  },
});

export const acceptInvite = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<Id<"workspaces">> => {
    const invite = await ctx.runQuery(internal.workspaces.inviteWorkspace, { token });
    const plan = invite ? await resolvePlan(invite.customerId) : "free";
    return await ctx.runMutation(internal.workspaces.acceptInviteWithPlan, { token, plan });
  },
});

export const setMemberRole = action({
  args: { memberId: v.id("workspaceMembers"), role: roleValidator },
  handler: async (ctx, args): Promise<null> => {
    const ws = await ctx.runQuery(internal.workspaces.memberWorkspace, { memberId: args.memberId });
    if (!ws) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    const plan = await resolvePlan(ws.customerId);
    await ctx.runMutation(internal.workspaces.setMemberRoleWithPlan, { ...args, plan });
    return null;
  },
});
