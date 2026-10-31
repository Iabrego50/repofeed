import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { enforceLimit } from "./lib/rateLimit";

/** Lets actions (which can't write directly) spend from a usage limit. */
export const enforce = internalMutation({
  args: {
    name: v.union(v.literal("deck"), v.literal("suggest")),
    subject: v.string(),
  },
  handler: async (ctx, { name, subject }) => {
    await enforceLimit(ctx, name, subject);
    return null;
  },
});
