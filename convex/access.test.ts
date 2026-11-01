import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Owner" });
  const member = t.withIdentity({ tokenIdentifier: "test|member", name: "Member" });
  const stranger = t.withIdentity({ tokenIdentifier: "test|stranger", name: "Stranger" });
  for (const u of [owner, member, stranger]) await u.mutation(api.users.updateCurrentUser, {});
  const workspaceId = await owner.mutation(api.workspaces.create, { name: "Acme" });
  const token = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 7 });
  await member.mutation(api.workspaces.acceptInvite, { token });
  const draftId = await owner.mutation(api.studies.create, { workspaceId, title: "Draft", audience: "PMs" });
  await owner.mutation(api.studies.addSource, { studyId: draftId, name: "a.txt", text: "Hello world" });
  return { t, owner, member, stranger, workspaceId, draftId };
}

describe("access rules", () => {
  it("members can't read draft studies or raw sources", async () => {
    const { member, workspaceId, draftId } = await setup();
    expect(await member.query(api.studies.list, { workspaceId })).toHaveLength(0);
    await expect(member.query(api.studies.get, { studyId: draftId })).rejects.toThrow();
    await expect(member.query(api.studies.listSources, { studyId: draftId })).rejects.toThrow();
  });

  it("non-members can't read anything", async () => {
    const { stranger, workspaceId, draftId } = await setup();
    await expect(stranger.query(api.studies.list, { workspaceId })).rejects.toThrow();
    await expect(stranger.query(api.workspaces.members, { workspaceId })).rejects.toThrow();
    await expect(stranger.query(api.studies.get, { studyId: draftId })).rejects.toThrow();
  });

  it("members see published studies and react only as themselves", async () => {
    const { owner, member, workspaceId } = await setup();
    const demoId = await owner.mutation(api.demo.createDemoWorkspace, {});
    const token = await owner.mutation(api.workspaces.createInvite, { workspaceId: demoId, role: "member", expiresInDays: 1 });
    await member.mutation(api.workspaces.acceptInvite, { token });
    const reels = await member.query(api.feed.list, { workspaceId: demoId });
    expect(reels.length).toBe(10);
    await member.mutation(api.feed.setReaction, { reelId: reels[0]._id, kind: "pushback" });
    const ownerView = await owner.query(api.feed.list, { workspaceId: demoId });
    expect(ownerView[0].counts.pushbackCount).toBe(1);
    // The owner's own reaction is separate; they can't change the member's.
    expect(ownerView[0].myReaction).toBeNull();
    // Tapping again removes it.
    await member.mutation(api.feed.setReaction, { reelId: reels[0]._id, kind: "pushback" });
    const after = await owner.query(api.feed.list, { workspaceId: demoId });
    expect(after[0].counts.pushbackCount).toBe(0);
    // Unrelated workspace still hidden.
    expect(await member.query(api.studies.list, { workspaceId })).toHaveLength(0);
  });

  it("the last owner can't be removed or demoted", async () => {
    const { owner, workspaceId } = await setup();
    const members = await owner.query(api.workspaces.members, { workspaceId });
    const self = members.find((m) => m.role === "owner");
    expect(self).toBeDefined();
    if (!self) return;
    await expect(owner.mutation(api.workspaces.removeMember, { memberId: self._id })).rejects.toThrow();
    await expect(owner.mutation(api.workspaces.setMemberRole, { memberId: self._id, role: "member" })).rejects.toThrow();
  });

  it("members can't remove other people", async () => {
    const { owner, member, workspaceId } = await setup();
    const members = await owner.query(api.workspaces.members, { workspaceId });
    const ownerRow = members.find((m) => m.role === "owner");
    if (!ownerRow) throw new Error("no owner");
    await expect(member.mutation(api.workspaces.removeMember, { memberId: ownerRow._id })).rejects.toThrow();
  });

  it("editing a quote to add a word flags and excludes the reel", async () => {
    const { owner } = await setup();
    const demoId = await owner.mutation(api.demo.createDemoWorkspace, {});
    const [study] = await owner.query(api.studies.list, { workspaceId: demoId });
    const reels = await owner.query(api.studies.reviewReels, { studyId: study._id });
    expect(reels.every((r) => r.warning === null && r.enabled)).toBe(true);
    const reel = reels.find((r) => r.scenes.some((s) => s.type === "quote"));
    if (!reel) throw new Error("no quote reel");
    const scenes = reel.scenes.map((s) => (s.type === "quote" ? { ...s, text: `${s.text} Really.` } : s));
    const { warning } = await owner.mutation(api.studies.updateReelScenes, { reelId: reel._id, title: reel.title, scenes });
    expect(warning).not.toBeNull();
    const updated = await owner.query(api.studies.reviewReels, { studyId: study._id });
    expect(updated.find((r) => r._id === reel._id)?.enabled).toBe(false);
  });
});
