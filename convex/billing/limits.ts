import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Plan } from "../schema/validators";

export const FREE_STUDY_LIMIT = 3;

/** Editor seats (owners + editors). Members (viewers) are unlimited on every plan. */
export const EDITOR_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: 1,
  team: Number.POSITIVE_INFINITY,
};

export const FEATURE_PRO = "feat_pro";
export const FEATURE_TEAM = "feat_team";
export const TRIAL_DAYS = 14;

export const VARIANTS = {
  pro: { month: "var_pro_monthly", year: "var_pro_yearly_24" },
  team: { month: "var_team_monthly", year: "var_team_yearly_48" },
} as const;

/** Team bills at least this many editor seats. */
export const TEAM_MIN_SEATS = 2;

export function teamSeats(editors: number): number {
  return Math.max(TEAM_MIN_SEATS, editors);
}

/** Billing interval of a variant this app sells, or null for unknown ones. */
export function variantInterval(variantId: string | undefined): "month" | "year" | null {
  for (const plan of Object.values(VARIANTS)) {
    if (plan.month === variantId) return "month";
    if (plan.year === variantId) return "year";
  }
  return null;
}

/** Pro features (decks, uploaded footage, AI backdrops) need a paid plan. */
export function assertPaid(plan: Plan, feature: string): void {
  if (plan !== "free") return;
  throw new ConvexError({
    code: "FORBIDDEN",
    message: `${feature} are part of Pro. Upgrade in Plan and billing to use them.`,
  });
}

const ACTIVE_STATUSES = ["draft", "generating", "review", "published"] as const;

/**
 * Non-archived studies, excluding the demo study, counted up to `cap` so the
 * read stays bounded. One extra row per status leaves room for the demo.
 */
export async function countActiveStudies(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  cap: number,
): Promise<number> {
  let total = 0;
  for (const status of ACTIVE_STATUSES) {
    const rows = await ctx.db
      .query("studies")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", status),
      )
      .take(cap - total + 1);
    total += rows.filter((r) => !r.isDemo).length;
    if (total >= cap) break;
  }
  return Math.min(total, cap);
}

/** Owners + editors, counted up to `cap`. */
export async function countEditors(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  cap: number,
): Promise<number> {
  let total = 0;
  for (const role of ["owner", "editor"] as const) {
    const rows = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_role", (q) =>
        q.eq("workspaceId", workspaceId).eq("role", role),
      )
      .take(cap - total);
    total += rows.length;
    if (total >= cap) break;
  }
  return total;
}

export async function assertStudySlot(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  plan: Plan,
): Promise<void> {
  if (plan !== "free") return;
  if ((await countActiveStudies(ctx, workspaceId, FREE_STUDY_LIMIT)) >= FREE_STUDY_LIMIT) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `The Free plan includes ${FREE_STUDY_LIMIT} active studies. Upgrade to Pro for unlimited studies, or archive one.`,
    });
  }
}

export async function assertEditorSeat(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  plan: Plan,
): Promise<void> {
  const limit = EDITOR_LIMIT[plan];
  if (!Number.isFinite(limit)) return;
  if ((await countEditors(ctx, workspaceId, limit)) >= limit) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Adding more editors needs the Team plan. Members who watch and discuss are always free.",
    });
  }
}
