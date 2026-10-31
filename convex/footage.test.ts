import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
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
  return { t, owner, member, workspaceId, reelId: reels[0]._id };
}

async function uploadClip(t: Awaited<ReturnType<typeof setup>>["t"], type: string) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(["clip"], { type })));
}

const reelFootage = async (s: Awaited<ReturnType<typeof setup>>) =>
  (await s.owner.query(api.feed.list, { workspaceId: s.workspaceId })).find((r) => r._id === s.reelId)?.footage;

describe("reel footage", () => {
  it("only editors can save clips", async () => {
    const s = await setup();
    const video = await uploadClip(s.t, "video/mp4");
    await expect(s.member.mutation(internal.footage.saveUploadWithPlan, { workspaceId: s.workspaceId, storageId: video, name: "clip" })).rejects.toThrow();
    await expect(s.member.query(api.footage.library, { workspaceId: s.workspaceId })).rejects.toThrow();
  });

  it("attaches an uploaded clip with a custom caption, and deleting the clip clears the reel", async () => {
    const s = await setup();
    const storageId = await uploadClip(s.t, "video/mp4");
    const clipId = await s.owner.mutation(internal.footage.saveUploadWithPlan, { workspaceId: s.workspaceId, storageId, name: "Home visit" });
    await s.owner.mutation(api.footage.setReelFootage, {
      reelId: s.reelId,
      footage: { caption: "  Home visit · P07 · Day 3 ", source: { kind: "upload", clipId } },
    });
    expect(await reelFootage(s)).toMatchObject({ caption: "Home visit · P07 · Day 3" });

    const { cleared } = await s.owner.mutation(api.footage.removeUpload, { clipId });
    expect(cleared).toBe(1);
    expect(await reelFootage(s)).toBeNull();
  });

  it("allows only built-in stock clips and supports removing footage", async () => {
    const s = await setup();
    await expect(
      s.owner.mutation(api.footage.setReelFootage, { reelId: s.reelId, footage: { caption: "", source: { kind: "stock", url: "https://evil.example/x.mp4" } } }),
    ).rejects.toThrow();
    await s.owner.mutation(api.footage.setReelFootage, { reelId: s.reelId, footage: { caption: "", source: { kind: "stock", url: "/footage/calendar.mp4" } } });
    expect(await reelFootage(s)).toMatchObject({ url: "/footage/calendar.mp4", caption: "" });
    await s.owner.mutation(api.footage.setReelFootage, { reelId: s.reelId, footage: null });
    expect(await reelFootage(s)).toBeNull();
  });
});
