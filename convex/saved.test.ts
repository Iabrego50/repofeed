import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Owner" });
  const member = t.withIdentity({ tokenIdentifier: "test|member", name: "Member" });
  const outsider = t.withIdentity({ tokenIdentifier: "test|outsider", name: "Outsider" });
  for (const u of [owner, member, outsider]) await u.mutation(api.users.updateCurrentUser, {});
  const workspaceId = await owner.mutation(api.demo.createDemoWorkspace, {});
  const invite = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1 });
  await member.mutation(api.workspaces.acceptInvite, { token: invite });
  const reels = await owner.query(api.feed.list, { workspaceId });
  return { t, owner, member, outsider, workspaceId, reels };
}

describe("saved reels", () => {
  it("toggles a scene in and out of a member's private Saved list", async () => {
    const { owner, member, workspaceId, reels } = await setup();
    const reelId = reels[2]._id;
    expect(await member.mutation(api.feed.toggleSave, { reelId })).toBe(true);

    const saved = await member.query(api.feed.saved, { workspaceId });
    expect(saved.map((r) => r._id)).toEqual([reelId]);
    expect(saved[0].saved).toBe(true);
    expect((await member.query(api.feed.list, { workspaceId })).find((r) => r._id === reelId)?.saved).toBe(true);

    // Other people's lists are unaffected.
    expect(await owner.query(api.feed.saved, { workspaceId })).toHaveLength(0);

    expect(await member.mutation(api.feed.toggleSave, { reelId })).toBe(false);
    expect(await member.query(api.feed.saved, { workspaceId })).toHaveLength(0);
  });

  it("blocks people outside the workspace", async () => {
    const { outsider, workspaceId, reels } = await setup();
    await expect(outsider.mutation(api.feed.toggleSave, { reelId: reels[0]._id })).rejects.toThrow();
    await expect(outsider.query(api.feed.saved, { workspaceId })).rejects.toThrow();
  });

  it("hides saved scenes an editor turned off", async () => {
    const { t, member, workspaceId, reels } = await setup();
    const reelId = reels[0]._id;
    await member.mutation(api.feed.toggleSave, { reelId });
    await t.run(async (ctx) => ctx.db.patch("reels", reelId, { enabled: false }));
    expect(await member.query(api.feed.saved, { workspaceId })).toHaveLength(0);
  });
});
