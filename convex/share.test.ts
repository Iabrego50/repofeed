import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Owner" });
  const member = t.withIdentity({ tokenIdentifier: "test|member", name: "Member" });
  for (const u of [owner, member]) await u.mutation(api.users.updateCurrentUser, {});
  const workspaceId = await owner.mutation(api.demo.createDemoWorkspace, {});
  const invite = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1 });
  await member.mutation(api.workspaces.acceptInvite, { token: invite });
  const reels = await owner.query(api.feed.list, { workspaceId });
  const studyId = reels[0].studyId;
  return { t, owner, member, workspaceId, studyId, reels };
}

describe("share links", () => {
  it("only editors can create links", async () => {
    const { member, owner, studyId } = await setup();
    await expect(member.mutation(api.share.createLink, { studyId })).rejects.toThrow();
    const token = await owner.mutation(api.share.createLink, { studyId });
    // Creating again returns the same live link.
    expect(await owner.mutation(api.share.createLink, { studyId })).toBe(token);
  });

  it("anyone with the link can watch without an account, but not interact unnamed", async () => {
    const { t, owner, workspaceId, studyId, reels } = await setup();
    const token = await owner.mutation(api.share.createLink, { studyId });
    const feed = await t.query(api.share.feed, { token });
    expect(feed?.reels).toHaveLength(10);
    expect(feed?.guest).toBeNull();
    await expect(
      t.mutation(api.share.setReaction, { token, secret: "made-up", reelId: reels[0]._id, kind: "true" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.share.addComment, { token, secret: "made-up", reelId: reels[0]._id, kind: "question", body: "Hi" }),
    ).rejects.toThrow();
    // Anonymous view still counts toward total views.
    await t.mutation(api.share.recordView, { token, reelId: reels[0]._id, completed: false });
    const after = await owner.query(api.feed.list, { workspaceId });
    expect(after.find((r) => r._id === reels[0]._id)?.counts.views).toBe(1);
  });

  it("named guests react and comment, and the team sees their name", async () => {
    const { t, owner, member, studyId, reels } = await setup();
    const token = await owner.mutation(api.share.createLink, { studyId });
    const { secret } = await t.mutation(api.share.join, { token, name: "  Priya   Patel " });
    const reelId = reels[0]._id;
    await t.mutation(api.share.setReaction, { token, secret, reelId, kind: "surprised" });
    await t.mutation(api.share.addComment, { token, secret, reelId, kind: "question", body: "Is this US only?" });

    const guestFeed = await t.query(api.share.feed, { token, secret });
    expect(guestFeed?.guest?.name).toBe("Priya Patel");
    expect(guestFeed?.reels[0].myReaction).toBe("surprised");

    const memberComments = await member.query(api.feed.comments, { reelId });
    expect(memberComments).toHaveLength(1);
    expect(memberComments[0].author).toMatchObject({ name: "Priya Patel", isGuest: true });
    expect(memberComments[0].isMine).toBe(false);

    // Guests can't resolve; the guest's own comment is deletable by them only.
    const guestComments = await t.query(api.share.comments, { token, reelId, secret });
    expect(guestComments[0].canResolve).toBe(false);
    expect(guestComments[0].isMine).toBe(true);
    const otherGuest = await t.mutation(api.share.join, { token, name: "Sam" });
    await expect(
      t.mutation(api.share.deleteComment, { token, secret: otherGuest.secret, commentId: guestComments[0]._id }),
    ).rejects.toThrow();
  });

  it("repeat plays by the same person count once a day", async () => {
    const { member, workspaceId, reels } = await setup();
    const reelId = reels[0]._id;
    for (let i = 0; i < 5; i++) await member.mutation(api.feed.recordView, { reelId, completed: false });
    await member.mutation(api.feed.recordView, { reelId, completed: true });
    const after = await member.query(api.feed.list, { workspaceId });
    expect(after.find((r) => r._id === reelId)?.counts).toMatchObject({ views: 1, viewers: 1, completions: 1 });
  });

  it("insights show named guests next to the team", async () => {
    const { t, owner, member, workspaceId, studyId, reels } = await setup();
    const reelId = reels[0]._id;
    const token = await owner.mutation(api.share.createLink, { studyId });
    const { secret } = await t.mutation(api.share.join, { token, name: "Priya" });
    await t.mutation(api.share.recordView, { token, secret, reelId, completed: true });
    await member.mutation(api.feed.recordView, { reelId, completed: false });
    const summary = await owner.query(api.insights.summary, { workspaceId });
    expect(summary).toMatchObject({ reached: 1, guestsReached: 1 });
    const row = summary.rows.find((r) => r.reelId === reelId);
    expect(row).toMatchObject({ viewers: 2, teamViewers: 1, guestViewers: 1, completions: 1 });
    const watchers = await owner.query(api.insights.watchers, { reelId });
    expect(watchers.map((w) => [w.name, w.isGuest]).sort()).toEqual([["Member", false], ["Priya", true]]);
    await expect(member.query(api.insights.watchers, { reelId })).rejects.toThrow();
  });

  it("turning off the link or unpublishing hides the feed", async () => {
    const { t, owner, studyId } = await setup();
    const token = await owner.mutation(api.share.createLink, { studyId });
    const { secret } = await t.mutation(api.share.join, { token, name: "Guest" });
    await owner.mutation(api.share.revokeLink, { studyId });
    expect(await t.query(api.share.feed, { token })).toBeNull();
    await expect(t.mutation(api.share.join, { token, name: "Late" })).rejects.toThrow();

    const fresh = await owner.mutation(api.share.createLink, { studyId });
    expect(fresh).not.toBe(token);
    // The old guest is tied to the study, but unpublishing hides the feed for everyone.
    await owner.mutation(api.studies.setPublished, { studyId, published: false });
    expect(await t.query(api.share.feed, { token: fresh, secret })).toBeNull();
  });

  it("a share token can't reach reels from other studies", async () => {
    const { t, owner, studyId } = await setup();
    const token = await owner.mutation(api.share.createLink, { studyId });
    const demo2 = await owner.mutation(api.demo.createDemoWorkspace, {});
    const otherReels = await owner.query(api.feed.list, { workspaceId: demo2 });
    await expect(t.query(api.share.evidence, { token, reelId: otherReels[0]._id })).rejects.toThrow();
    await expect(t.query(api.share.comments, { token, reelId: otherReels[0]._id })).rejects.toThrow();
  });

  it("copying a reel link gives a public link that needs no account", async () => {
    const { t, owner, member, studyId, reels } = await setup();
    const reelId = reels[0]._id;
    // Members can't turn sharing on themselves.
    await expect(member.mutation(api.share.reelShareLink, { reelId })).rejects.toThrow(/editor/);
    expect(await t.query(api.share.publicTokenForReel, { reelId })).toBeNull();

    const token = await owner.mutation(api.share.reelShareLink, { reelId });
    expect(await owner.mutation(api.share.createLink, { studyId })).toBe(token);
    expect(await member.mutation(api.share.reelShareLink, { reelId })).toBe(token);
    // Old member links resolve to the public link for signed-out visitors.
    expect(await t.query(api.share.publicTokenForReel, { reelId })).toBe(token);
    expect(await t.query(api.share.publicTokenForReel, { reelId: "not-an-id" })).toBeNull();

    await owner.mutation(api.share.revokeLink, { studyId });
    expect(await t.query(api.share.publicTokenForReel, { reelId })).toBeNull();
  });
});
