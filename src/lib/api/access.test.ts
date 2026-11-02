import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({ fake: null as FakeSupabase | null }));

vi.mock("../supabase", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client };
});

function fake(): FakeSupabase {
  if (!bag.fake) throw new Error("fake supabase not initialized");
  return bag.fake;
}

import { canSeeStudy, canRemoveMember } from "./access";
import { listStudies, getStudy, listSources, updateReelScenes } from "./studies-complete";
import { removeMember } from "./workspaces-complete";
import { react } from "./feed-complete";

describe("study access control", () => {
  beforeEach(() => {
    fake().reset();
  });

  it("members can't read draft studies or raw sources", async () => {
    expect(canSeeStudy("draft", "member")).toBe(false);
    expect(canSeeStudy("published", "member")).toBe(true);

    fake().setUser({ id: "member-1" });
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("studies", { data: [] });
    const listed = await listStudies({ workspaceId: "ws1" });
    expect(listed).toEqual([]);
    expect(fake().filterEq(fake().lastCall("studies", "select")!, "status")).toBe("published");

    fake().queue("studies", { data: { id: "draft-1", workspace_id: "ws1", status: "draft", created_at: "2024-01-01" } });
    fake().queue("workspace_members", { data: { role: "member" } });
    const study = await getStudy({ studyId: "draft-1" });
    expect(study.role).toBe("member");

    fake().queue("studies", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: null });
    await expect(listSources({ studyId: "draft-1" })).rejects.toThrow(/authorized/);
  });

  it("non-members can't read anything", async () => {
    fake().setUser({ id: "stranger" });
    fake().queue("workspace_members", { data: null });
    await expect(listStudies({ workspaceId: "ws1" })).rejects.toThrow(/member/);

    fake().queue("studies", { data: { id: "s1", workspace_id: "ws1", status: "published", created_at: "2024-01-01" } });
    fake().queue("workspace_members", { data: null });
    await expect(getStudy({ studyId: "s1" })).rejects.toThrow(/authorized/);
  });

  it("members see published studies and react only as themselves", async () => {
    fake().setUser({ id: "member-1" });
    fake().queue("reels", { data: { study_id: "s1", workspace_id: "ws1" } });
    fake().queue("reels", { data: { enabled: true } });
    fake().queue("reactions", { data: null });
    expect(await react({ reelId: "r1", kind: "pushback" })).toBe("pushback");
    expect(fake().lastCall("reactions", "insert")?.payload).toEqual(expect.objectContaining({
      reel_id: "r1",
      user_id: "member-1",
      kind: "pushback",
    }));

    fake().queue("reels", { data: { study_id: "s1", workspace_id: "ws1" } });
    fake().queue("reels", { data: { enabled: true } });
    fake().queue("reactions", { data: { id: "rx1", kind: "pushback" } });
    expect(await react({ reelId: "r1", kind: "pushback" })).toBeNull();
    expect(fake().filterEq(fake().lastCall("reactions", "delete")!, "id")).toBe("rx1");
  });

  it("the last owner can't be removed or demoted", async () => {
    expect(() => canRemoveMember("owner", "owner", true, 1)).toThrow(/last owner/);
    fake().setUser({ id: "owner-1" });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspace_members", { count: 1 });
    fake().queue("workspace_members", { data: { role: "owner" } });
    await expect(removeMember({ workspaceId: "ws1", userId: "owner-1" })).rejects.toThrow(/last owner/);
  });

  it("members can't remove other people", async () => {
    expect(() => canRemoveMember("member", "owner", false, 1)).toThrow(/owner/);
    fake().setUser({ id: "member-1" });
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("workspace_members", { count: 1 });
    fake().queue("workspace_members", { data: { role: "owner" } });
    await expect(removeMember({ workspaceId: "ws1", userId: "owner-1" })).rejects.toThrow(/owner/);
  });

  it("editing a quote to add a word flags and excludes the reel", async () => {
    fake().setUser({ id: "owner-1" });
    fake().queue("reels", { data: { workspace_id: "ws1", study_id: "s1", title: "Quote" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("sources", { data: [{ text: "Hello world from users" }] });
    const { warning } = await updateReelScenes({
      reelId: "r1",
      title: "Quote",
      scenes: [{ type: "quote", text: "Hello world from users Really." }],
    });
    expect(warning).not.toBeNull();
    expect(fake().lastCall("reels", "update")?.payload).toEqual(expect.objectContaining({
      warning,
      enabled: false,
    }));
  });
});
