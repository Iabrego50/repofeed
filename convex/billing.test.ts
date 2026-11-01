import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Owner" });
  const other = t.withIdentity({ tokenIdentifier: "test|other", name: "Other" });
  for (const u of [owner, other]) await u.mutation(api.users.updateCurrentUser, {});
  const workspaceId = await owner.mutation(api.workspaces.create, { name: "Acme" });
  return { t, owner, other, workspaceId };
}

describe("plan limits", () => {
  it("free workspaces get 3 active studies; archiving frees a slot", async () => {
    const { owner, workspaceId } = await setup();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await owner.mutation(api.studies.create, { workspaceId, title: `S${i}`, audience: "PMs" }));
    await expect(owner.mutation(api.studies.create, { workspaceId, title: "S4", audience: "PMs" })).rejects.toThrow(/Free plan/);
    await owner.mutation(api.studies.remove, { studyId: ids[0] });
    await expect(owner.mutation(api.studies.create, { workspaceId, title: "S4", audience: "PMs" })).resolves.toBeDefined();
  });

  it("restoring an archived study needs a free slot", async () => {
    const { owner, workspaceId } = await setup();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await owner.mutation(api.studies.create, { workspaceId, title: `S${i}`, audience: "PMs" }));
    await owner.mutation(api.studies.archive, { studyId: ids[0] });
    await owner.mutation(api.studies.create, { workspaceId, title: "S3", audience: "PMs" });
    await expect(owner.mutation(api.studies.restore, { studyId: ids[0] })).rejects.toThrow(/Free plan/);
    await owner.mutation(api.studies.archive, { studyId: ids[1] });
    await expect(owner.mutation(api.studies.restore, { studyId: ids[0] })).resolves.toBeNull();
  });

  it("the demo study does not use a free slot", async () => {
    const { t, owner, workspaceId } = await setup();
    const demoId = await owner.mutation(api.studies.create, { workspaceId, title: "Demo", audience: "PMs" });
    await t.run((ctx) => ctx.db.patch("studies", demoId, { isDemo: true }));
    for (let i = 0; i < 3; i++) {
      await expect(owner.mutation(api.studies.create, { workspaceId, title: `S${i}`, audience: "PMs" })).resolves.toBeDefined();
    }
    await expect(owner.mutation(api.studies.create, { workspaceId, title: "S4", audience: "PMs" })).rejects.toThrow(/Free plan/);
  });

  it("deleting a study hides it from the list", async () => {
    const { owner, workspaceId } = await setup();
    const studyId = await owner.mutation(api.studies.create, { workspaceId, title: "Gone", audience: "PMs" });
    await owner.mutation(api.studies.destroy, { studyId });
    expect(await owner.query(api.studies.list, { workspaceId })).toHaveLength(0);
  });

  it("pro workspaces have unlimited studies", async () => {
    const { owner, workspaceId } = await setup();
    for (let i = 0; i < 4; i++) {
      await owner.mutation(internal.studies.createWithPlan, { workspaceId, title: `S${i}`, audience: "PMs", plan: "pro" });
    }
    expect((await owner.query(api.billing.data.usage, { workspaceId })).studies).toBe(4);
  });

  it("editor invites and promotions need the Team plan", async () => {
    const { owner, other, workspaceId } = await setup();
    await expect(owner.mutation(api.workspaces.createInvite, { workspaceId, role: "editor", expiresInDays: 1 })).rejects.toThrow(/Team plan/);
    // Member invites are always free.
    const token = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1 });
    await other.mutation(api.workspaces.acceptInvite, { token });
    const member = (await owner.query(api.workspaces.members, { workspaceId })).find((m) => m.role === "member");
    if (!member) throw new Error("no member");
    await expect(owner.mutation(api.workspaces.setMemberRole, { memberId: member._id, role: "editor" })).rejects.toThrow(/Team plan/);
    await owner.mutation(internal.workspaces.setMemberRoleWithPlan, { memberId: member._id, role: "editor", plan: "team" });
    expect((await owner.query(api.billing.data.usage, { workspaceId })).editors).toBe(2);
  });

  it("an editor invite accepted after a downgrade is blocked", async () => {
    const { owner, other, workspaceId } = await setup();
    const token = await owner.mutation(internal.workspaces.createInviteWithPlan, { workspaceId, role: "editor", expiresInDays: 1, plan: "team" });
    await expect(other.mutation(api.workspaces.acceptInvite, { token })).rejects.toThrow(/Team plan/);
    await expect(other.mutation(internal.workspaces.acceptInviteWithPlan, { token, plan: "team" })).resolves.toBe(workspaceId);
  });
});

/** Adds `other` as an editor on a Team workspace and returns their member row id. */
async function addEditor(s: Awaited<ReturnType<typeof setup>>) {
  const token = await s.owner.mutation(internal.workspaces.createInviteWithPlan, { workspaceId: s.workspaceId, role: "editor", expiresInDays: 1, plan: "team" });
  await s.other.mutation(internal.workspaces.acceptInviteWithPlan, { token, plan: "team" });
  const row = (await s.owner.query(api.workspaces.members, { workspaceId: s.workspaceId })).find((m) => !m.isMe);
  if (!row) throw new Error("no editor");
  return row._id;
}

describe("plan lifecycle", () => {
  it("dropping from Team to Free pauses extra editors and flags the ended plan", async () => {
    const s = await setup();
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "team" });
    await addEditor(s);
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "free" });

    const usage = await s.owner.query(api.billing.data.usage, { workspaceId: s.workspaceId });
    expect(usage).toMatchObject({ lapsedPlan: "team", seatOverage: true });
    // The non-owner editor now acts as a member and can't create studies.
    const [mine] = await s.other.query(api.workspaces.listMine, {});
    expect(mine).toMatchObject({ role: "member", seatPaused: true });
    await expect(s.other.mutation(api.studies.create, { workspaceId: s.workspaceId, title: "X", audience: "PMs" })).rejects.toThrow(/paused/);
    // The owner keeps editing.
    await expect(s.owner.mutation(api.studies.create, { workspaceId: s.workspaceId, title: "Y", audience: "PMs" })).resolves.toBeDefined();
  });

  it("removing the extra editor ends the pause", async () => {
    const s = await setup();
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "team" });
    const editorRow = await addEditor(s);
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "free" });
    await s.owner.mutation(api.workspaces.removeMember, { memberId: editorRow });
    expect((await s.owner.query(api.billing.data.usage, { workspaceId: s.workspaceId })).seatOverage).toBe(false);
  });

  it("renewing clears the ended-plan notice", async () => {
    const s = await setup();
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "pro" });
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "free" });
    expect((await s.owner.query(api.billing.data.usage, { workspaceId: s.workspaceId })).lapsedPlan).toBe("pro");
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "pro" });
    expect((await s.owner.query(api.billing.data.usage, { workspaceId: s.workspaceId })).lapsedPlan).toBeNull();
  });

  it("the free trial is used up once the person's checkout becomes a paid plan", async () => {
    const s = await setup();
    const me = (await s.owner.query(api.workspaces.members, { workspaceId: s.workspaceId }))[0];
    await s.owner.mutation(internal.billing.data.recordCheckout, {
      workspaceId: s.workspaceId,
      userId: me.userId,
      variantId: "var_pro_monthly",
      seats: 1,
      returnUrl: "https://example.com/billing",
    });
    expect((await s.owner.query(api.billing.data.usage, { workspaceId: s.workspaceId })).trialUsed).toBe(false);
    await s.owner.mutation(internal.billing.data.syncPlan, { workspaceId: s.workspaceId, plan: "pro" });
    // Trial use follows the person into every other workspace.
    const second = await s.owner.mutation(api.workspaces.create, { name: "Second" });
    expect((await s.owner.query(api.billing.data.usage, { workspaceId: second })).trialUsed).toBe(true);
  });
});
