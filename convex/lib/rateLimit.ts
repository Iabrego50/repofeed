import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Limit = { max: number; windowMs: number; message: string };

/** Caps on actions that cost AI credits or could be used to spam a workspace. */
export const LIMITS = {
  createWorkspace: { max: 5, windowMs: DAY, message: "You've created several workspaces today. Try again tomorrow." },
  generate: { max: 20, windowMs: DAY, message: "This workspace has hit today's limit for generating reels. Try again tomorrow." },
  paint: { max: 200, windowMs: DAY, message: "This workspace has hit today's limit for AI scenes. Try again tomorrow." },
  deck: { max: 20, windowMs: DAY, message: "This workspace has hit today's limit for decks. Try again tomorrow." },
  suggest: { max: 40, windowMs: DAY, message: "AI suggestions are paused for today. Fill in the details yourself or try tomorrow." },
  upload: { max: 300, windowMs: DAY, message: "This workspace has hit today's upload limit. Try again tomorrow." },
  guestJoin: { max: 100, windowMs: HOUR, message: "Too many people joined through this link just now. Try again in a little while." },
  guestComment: { max: 30, windowMs: HOUR, message: "You're commenting very quickly. Take a short break and try again." },
  anonView: { max: 500, windowMs: HOUR, message: "" },
  // Per recipient: at most this many feedback emails an hour; the rest are skipped quietly.
  feedbackEmail: { max: 12, windowMs: HOUR, message: "" },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

/** Uses `cost` from the budget; returns false (writing nothing) when it would go over. */
export async function tryConsume(
  ctx: MutationCtx,
  name: LimitName,
  subject: string,
  cost = 1,
): Promise<boolean> {
  const { max, windowMs } = LIMITS[name];
  const key = `${name}:${subject}`;
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const now = Date.now();
  if (!row || now - Date.parse(row.windowStart) >= windowMs) {
    if (cost > max) return false;
    const fresh = { windowStart: new Date(now).toISOString(), count: cost };
    if (row) await ctx.db.patch("rateLimits", row._id, fresh);
    else await ctx.db.insert("rateLimits", { key, ...fresh });
    return true;
  }
  if (row.count + cost > max) return false;
  await ctx.db.patch("rateLimits", row._id, { count: row.count + cost });
  return true;
}

/** Like `tryConsume`, but throws a friendly error when the limit is reached. */
export async function enforceLimit(
  ctx: MutationCtx,
  name: LimitName,
  subject: string,
  cost = 1,
): Promise<void> {
  if (!(await tryConsume(ctx, name, subject, cost))) {
    throw new ConvexError({ code: "FORBIDDEN", message: LIMITS[name].message });
  }
}
