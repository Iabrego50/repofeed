import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Owner", email: "owner@example.com" });
  const other = t.withIdentity({ tokenIdentifier: "test|other", name: "Other", email: "other@example.com" });
  for (const u of [owner, other]) await u.mutation(api.users.updateCurrentUser, {});
  // The demo workspace comes with a published study and scenes.
  const workspaceId = await owner.mutation(api.demo.createDemoWorkspace, {});
  return { t, owner, other, workspaceId };
}

async function otherRowId(s: Awaited<ReturnType<typeof setup>>) {
  const row = (await s.owner.query(api.workspaces.members, { workspaceId: s.workspaceId })).find((m) => !m.isMe);
  if (!row) throw new Error("no other member");
  return row._id;
}

describe("identity and access review fixes", () => {
  it("a removed person can't rejoin with an old link, but can with a new owner invite", async () => {
    const s = await setup();
    const oldLink = await s.owner.mutation(api.workspaces.createInvite, { workspaceId: s.workspaceId, role: "member", expiresInDays: 7 });
    await s.other.mutation(api.workspaces.acceptInvite, { token: oldLink });
    await s.owner.mutation(api.workspaces.removeMember, { memberId: await otherRowId(s) });

    await expect(s.other.mutation(api.workspaces.acceptInvite, { token: oldLink })).rejects.toThrow(/removed/);
    expect((await s.other.query(api.workspaces.peekInvite, { token: oldLink })).status).toBe("invalid");

    const fresh = await s.owner.mutation(api.workspaces.createInvite, { workspaceId: s.workspaceId, role: "member", expiresInDays: 7 });
    await expect(s.other.mutation(api.workspaces.acceptInvite, { token: fresh })).resolves.toBe(s.workspaceId);
  });

  it("removing someone turns off the invite links they created", async () => {
    const s = await setup();
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "team" });
    const editorLink = await s.owner.mutation(internal.workspaces.createInviteWithPlan, { workspaceId: s.workspaceId, role: "editor", expiresInDays: 7, plan: "team" });
    await s.other.mutation(internal.workspaces.acceptInviteWithPlan, { token: editorLink, plan: "team" });
    const theirLink = await s.other.mutation(api.workspaces.createInvite, { workspaceId: s.workspaceId, role: "member", expiresInDays: 7 });
    await s.owner.mutation(api.workspaces.removeMember, { memberId: await otherRowId(s) });
    expect((await s.owner.query(api.workspaces.peekInvite, { token: theirLink })).status).toBe("invalid");
  });

  it("only owners can create editor invites", async () => {
    const s = await setup();
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "team" });
    const token = await s.owner.mutation(internal.workspaces.createInviteWithPlan, { workspaceId: s.workspaceId, role: "editor", expiresInDays: 1, plan: "team" });
    await s.other.mutation(internal.workspaces.acceptInviteWithPlan, { token, plan: "team" });

    await expect(
      s.other.mutation(internal.workspaces.createInviteWithPlan, { workspaceId: s.workspaceId, role: "editor", expiresInDays: 1, plan: "team" }),
    ).rejects.toThrow(/owners/);
    await expect(
      s.other.mutation(api.workspaces.createInvite, { workspaceId: s.workspaceId, role: "member", expiresInDays: 1 }),
    ).resolves.toBeDefined();
  });

  it("editors paused by seat limits are treated as members everywhere", async () => {
    const s = await setup();
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "team" });
    const token = await s.owner.mutation(internal.workspaces.createInviteWithPlan, { workspaceId: s.workspaceId, role: "editor", expiresInDays: 1, plan: "team" });
    await s.other.mutation(internal.workspaces.acceptInviteWithPlan, { token, plan: "team" });
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "free" });

    expect((await s.other.query(api.workspaces.get, { workspaceId: s.workspaceId }))?.role).toBe("member");
    const members = await s.other.query(api.workspaces.members, { workspaceId: s.workspaceId });
    expect(members.every((m) => m.email === undefined)).toBe(true);

    const reels = await s.owner.query(api.feed.list, { workspaceId: s.workspaceId });
    await expect(s.other.mutation(api.share.reelShareLink, { reelId: reels[0]._id })).rejects.toThrow(/Ask an editor/);

    await s.owner.mutation(api.feed.addComment, { reelId: reels[0]._id, kind: "question", body: "owner's" });
    const comment = (await s.other.query(api.feed.comments, { reelId: reels[0]._id })).find((c) => c.body === "owner's");
    expect(comment?.canDelete).toBe(false);
    await expect(s.other.mutation(api.feed.deleteComment, { commentId: comment!._id })).rejects.toThrow();
  });

  it("guests' comment counts leave out hidden team comments", async () => {
    const s = await setup();
    const reels = await s.owner.query(api.feed.list, { workspaceId: s.workspaceId });
    const reelId = reels[0]._id;
    const token = await s.owner.mutation(api.share.createLink, { studyId: reels[0].studyId });
    const before = (await s.t.query(api.share.feed, { token }))?.reels.find((r) => r._id === reelId)?.counts.commentCount;

    await s.owner.mutation(api.feed.addComment, { reelId, kind: "question", body: "internal" });
    const { secret } = await s.t.mutation(api.share.join, { token, name: "Guest" });
    await s.t.mutation(api.share.addComment, { token, secret, reelId, kind: "question", body: "from guest" });

    const hidden = (await s.t.query(api.share.feed, { token }))?.reels.find((r) => r._id === reelId)?.counts;
    expect(hidden).toMatchObject({ commentCount: 1, openCount: 1 });
    expect(before).toBe(0);

    await s.owner.mutation(api.share.setHideTeamComments, { studyId: reels[0].studyId, hide: false });
    const shown = (await s.t.query(api.share.feed, { token }))?.reels.find((r) => r._id === reelId)?.counts;
    expect(shown?.commentCount).toBe(2);
  });
});
