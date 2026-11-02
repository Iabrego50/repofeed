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

import { archiveStudy, createStudy, deleteStudy, publishStudy, updateStudy } from "./studies-complete";
import { assertStudySlot } from "../billing/limits";

describe("study lifecycle", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "user1" });
  });

  it("createStudy inserts with required fields", async () => {
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { paid_plan: "pro" } });
    fake().queue("studies", { data: { id: "study-1", title: "New Study" } });
    const id = await createStudy({
      workspaceId: "ws1",
      title: "New Study",
      audience: "Learn about users and onboarding",
    });
    expect(id).toBe("study-1");
    expect(fake().lastCall("studies", "insert")?.payload).toEqual(expect.objectContaining({
      workspace_id: "ws1",
      title: "New Study",
      audience: "Learn about users and onboarding",
      status: "draft",
      created_by: "user1",
    }));
  });

  it("archiveStudy updates status", async () => {
    fake().queue("studies", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    await archiveStudy({ studyId: "study-1" });
    expect(fake().lastCall("studies", "update")?.payload).toEqual(expect.objectContaining({ status: "archived" }));
    expect(fake().filterEq(fake().lastCall("studies", "update")!, "id")).toBe("study-1");
  });

  it("publishStudy sets published status and reports first publish", async () => {
    fake().queue("studies", { data: { workspace_id: "ws1", status: "review", published_at: null, title: "S", created_by: "user1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    const result = await publishStudy({ studyId: "study-1" });
    expect(result.firstPublish).toBe(true);
    expect(fake().lastCall("studies", "update")?.payload).toEqual(expect.objectContaining({ status: "published" }));
  });

  it("updateStudy modifies title and goal", async () => {
    fake().queue("studies", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    await updateStudy({
      studyId: "study-1",
      title: "Updated Title",
      audience: "New audience",
    });
    expect(fake().lastCall("studies", "update")?.payload).toEqual(expect.objectContaining({
      title: "Updated Title",
      audience: "New audience",
    }));
  });

  it("deleteStudy marks the study and removes source storage objects", async () => {
    fake().queue("studies", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("sources", { data: [{ storage_id: "file1" }, { storage_id: "file2" }] });
    await deleteStudy({ studyId: "study1" });
    expect(fake().lastCall("studies", "update")?.payload).toEqual(expect.objectContaining({ deleting: true }));
    expect(fake().storageRemoves).toEqual([{ bucket: "uploads", paths: ["file1", "file2"] }]);
  });

  it("assertStudySlot blocks a fourth free study and allows pro", async () => {
    fake().queue("studies", { count: 3 });
    await expect(assertStudySlot("ws1", "free")).rejects.toThrow(/Free plan/);
    await expect(assertStudySlot("ws1", "pro")).resolves.toBeUndefined();
  });
});
