import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const avatar =
      typeof identity.pictureUrl === "string"
        ? identity.pictureUrl
        : identity.profileUrl;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      if (
        user.name !== identity.name ||
        user.email !== identity.email ||
        user.avatar !== avatar
      ) {
        await ctx.db.patch("users", user._id, {
          name: identity.name,
          email: identity.email,
          avatar,
        });
      }
      return user._id;
    }
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      avatar,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

/** Marks the feed tour as done so it doesn't show again. */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    // The sign-in sync may not have created the row yet; create it so the tour stays dismissed.
    if (!user) {
      await ctx.db.insert("users", {
        name: identity.name,
        email: identity.email,
        tokenIdentifier: identity.tokenIdentifier,
        onboardedAt: new Date().toISOString(),
      });
      return null;
    }
    if (!user.onboardedAt) {
      await ctx.db.patch("users", user._id, { onboardedAt: new Date().toISOString() });
    }
    return null;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
