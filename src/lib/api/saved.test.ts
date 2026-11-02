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

import { listSavedReels, toggleSave } from "./feed-complete";

describe("saved reels", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "member-1" });
  });

  it("toggles a scene in and out of a member's private Saved list", async () => {
    fake().queue("reels", { data: { workspace_id: "ws1", study_id: "s1", enabled: true } });
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("saved_reels", { data: null });
    fake().queue("reels", { data: { workspace_id: "ws1", study_id: "s1" } });
    fake().queue("workspace_members", { data: { id: "m1" } });
    expect(await toggleSave({ reelId: "r2" })).toBe(true);
    expect(fake().lastCall("saved_reels", "upsert")?.payload).toEqual(expect.objectContaining({
      user_id: "member-1",
      reel_id: "r2",
      workspace_id: "ws1",
      study_id: "s1",
    }));

    fake().queue("reels", { data: { workspace_id: "ws1", study_id: "s1", enabled: true } });
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("saved_reels", { data: { id: "sv1" } });
    expect(await toggleSave({ reelId: "r2" })).toBe(false);
    expect(fake().filterEq(fake().lastCall("saved_reels", "delete")!, "user_id")).toBe("member-1");
    expect(fake().filterEq(fake().lastCall("saved_reels", "delete")!, "reel_id")).toBe("r2");
  });

  it("blocks people outside the workspace", async () => {
    fake().queue("reels", { data: { workspace_id: "ws1", study_id: "s1", enabled: true } });
    fake().queue("workspace_members", { data: null });
    await expect(toggleSave({ reelId: "r1" })).rejects.toThrow(/authorized/);

    fake().queue("workspace_members", { data: null });
    await expect(listSavedReels({ workspaceId: "ws1", userId: "member-1" })).rejects.toThrow(/authorized/);
  });

  it("hides saved scenes an editor turned off", async () => {
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("saved_reels", { data: [{ reel_id: "r1" }, { reel_id: "r2" }] });
    fake().queue("reels", {
      data: [{
        id: "r1",
        workspace_id: "ws1",
        study_id: "s1",
        position: 0,
        track: "t",
        track_index: 0,
        title: "On",
        scenes: [],
        finding_ids: [],
        source_names: [],
        footage: null,
        warning: null,
        enabled: true,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      }],
    });
    const saved = await listSavedReels({ workspaceId: "ws1", userId: "member-1" });
    expect(saved.map((r) => r._id)).toEqual(["r1"]);
    expect(saved[0].saved).toBe(true);
    expect(fake().filterEq(fake().lastCall("reels", "select")!, "enabled")).toBe(true);
  });

  it("refuses to save another user's list and records the user_id filter", async () => {
    await expect(listSavedReels({ workspaceId: "ws1", userId: "someone-else" })).rejects.toThrow(/authorized/);
  });
});
