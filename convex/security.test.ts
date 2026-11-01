import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Owner", email: "owner@example.com" });
  const member = t.withIdentity({ tokenIdentifier: "test|member", name: "Member" });
  for (const u of [owner, member]) await u.mutation(api.users.updateCurrentUser, {});
  const workspaceId = await owner.mutation(api.demo.createDemoWorkspace, {});
  return { t, owner, member, workspaceId };
}

describe("security safeguards", () => {
  it("caps how many workspaces one person can create in a day", async () => {
    const { owner } = await setup();
    for (let i = 0; i < 4; i++) await owner.mutation(api.workspaces.create, { name: `Team ${i}` });
    await expect(owner.mutation(api.workspaces.create, { name: "One too many" })).rejects.toThrow(/tomorrow/);
  });

  it("single-use invites stop working after one join, and members don't see emails", async () => {
    const { t, owner, member, workspaceId } = await setup();
    const token = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1, maxUses: 1 });
    await member.mutation(api.workspaces.acceptInvite, { token });
    const late = t.withIdentity({ tokenIdentifier: "test|late", name: "Late" });
    await late.mutation(api.users.updateCurrentUser, {});
    await expect(late.mutation(api.workspaces.acceptInvite, { token })).rejects.toThrow(/used up/);

    const asMember = await member.query(api.workspaces.members, { workspaceId });
    expect(asMember.every((m) => m.email === undefined)).toBe(true);
    const asOwner = await owner.query(api.workspaces.members, { workspaceId });
    expect(asOwner.find((m) => m.isMe)?.email).toBe("owner@example.com");
  });

  it("an upload can't be attached by a second workspace", async () => {
    const { t, owner, workspaceId } = await setup();
    const other = await owner.mutation(api.workspaces.create, { name: "Other" });
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["clip"], { type: "video/mp4" })));
    await owner.mutation(internal.footage.saveUploadWithPlan, { workspaceId, storageId, name: "Clip" });
    await expect(owner.mutation(internal.footage.saveUploadWithPlan, { workspaceId: other, storageId, name: "Stolen" })).rejects.toThrow();
  });

  it("editors can delete guest comments, and guests don't see team comments by default", async () => {
    const { t, owner, member, workspaceId } = await setup();
    const invite = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1 });
    await member.mutation(api.workspaces.acceptInvite, { token: invite });
    const reels = await owner.query(api.feed.list, { workspaceId });
    const reelId = reels[0]._id;
    const token = await owner.mutation(api.share.createLink, { studyId: reels[0].studyId });
    const { secret } = await t.mutation(api.share.join, { token, name: "Guest" });
    await t.mutation(api.share.addComment, { token, secret, reelId, kind: "note", body: "spam" });
    await owner.mutation(api.feed.addComment, { reelId, kind: "note", body: "internal" });

    const guestView = await t.query(api.share.comments, { token, reelId, secret });
    expect(guestView.map((c) => c.body)).toEqual(["spam"]);

    const memberView = await member.query(api.feed.comments, { reelId });
    const guestComment = memberView.find((c) => c.body === "spam");
    expect(guestComment?.canDelete).toBe(false);
    await expect(member.mutation(api.feed.deleteComment, { commentId: guestComment!._id })).rejects.toThrow();
    await owner.mutation(api.feed.deleteComment, { commentId: guestComment!._id });
    expect((await owner.query(api.feed.comments, { reelId })).map((c) => c.body)).toEqual(["internal"]);
  });

  it("members can't interact with scenes an editor turned off", async () => {
    const { owner, member, workspaceId } = await setup();
    const invite = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1 });
    await member.mutation(api.workspaces.acceptInvite, { token: invite });
    const reels = await owner.query(api.feed.list, { workspaceId });
    await owner.mutation(api.studies.setReelEnabled, { reelId: reels[0]._id, enabled: false });
    await expect(member.query(api.feed.evidence, { reelId: reels[0]._id })).rejects.toThrow();
    await expect(member.mutation(api.feed.setReaction, { reelId: reels[0]._id, kind: "true" })).rejects.toThrow();
  });
});
