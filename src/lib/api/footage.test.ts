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

import {
  isStockClip,
  listLibrary,
  normalizeFootageCaption,
  removeUpload,
  saveUpload,
  setReelFootage,
  STOCK_CLIPS,
  validateFootage,
} from "./footage";

describe("reel footage", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "owner-1" });
  });

  it("only editors can save clips or read the library", async () => {
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    await expect(saveUpload({ workspaceId: "ws1", storageId: "st1", name: "clip" })).rejects.toThrow(/editor/);

    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    await expect(listLibrary({ workspaceId: "ws1" })).rejects.toThrow(/editor/);
  });

  it("attaches an uploaded clip with a trimmed caption, and deleting the clip clears the reel", async () => {
    expect(normalizeFootageCaption("  Home visit · P07 · Day 3 ")).toBe("Home visit · P07 · Day 3");

    fake().queue("reels", { data: { id: "r1", workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    const stored = await setReelFootage({
      reelId: "r1",
      footage: { caption: "  Home visit · P07 · Day 3 ", source: { kind: "upload", clipId: "clip-1" } },
    });
    expect(stored).toMatchObject({ caption: "Home visit · P07 · Day 3" });
    expect(fake().lastCall("reels", "update")?.payload).toEqual(expect.objectContaining({
      footage: expect.objectContaining({ caption: "Home visit · P07 · Day 3", source: { kind: "upload", clipId: "clip-1" } }),
    }));

    fake().queue("footage_clips", { data: { id: "clip-1", workspace_id: "ws1", storage_id: "abc-123" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("reels", {
      data: [
        { id: "r1", footage: { source: { clipId: "clip-1" } } },
        { id: "r2", footage: { source: { clipId: "other" } } },
      ],
    });
    const { cleared } = await removeUpload({ clipId: "clip-1" });
    expect(cleared).toBe(1);
    expect(fake().lastCall("reels", "update")?.payload).toEqual(expect.objectContaining({ footage: null }));
    expect(fake().lastCall("footage_clips", "delete")).toBeDefined();
    expect(fake().filterEq(fake().lastCall("footage_clips", "delete")!, "id")).toBe("clip-1");
    expect(fake().storageRemoves).toEqual([{ bucket: "footage", paths: ["abc-123"] }]);
  });

  it("allows only built-in stock clips and supports removing footage", async () => {
    expect(isStockClip("/footage/calendar.mp4")).toBe(true);
    expect(isStockClip("https://evil.com/video.mp4")).toBe(false);
    expect(STOCK_CLIPS.some((c) => c.url === "/footage/calendar.mp4")).toBe(true);

    expect(() =>
      validateFootage({ caption: "", source: { kind: "stock", url: "https://evil.example/x.mp4" } }),
    ).toThrow(/stock/);

    fake().queue("reels", { data: { id: "r1", workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    const attached = await setReelFootage({
      reelId: "r1",
      footage: { caption: "", source: { kind: "stock", url: "/footage/calendar.mp4" } },
    });
    expect(attached).toMatchObject({ url: "/footage/calendar.mp4", caption: "" });

    fake().queue("reels", { data: { id: "r1", workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    expect(await setReelFootage({ reelId: "r1", footage: null })).toBeNull();
    expect(fake().lastCall("reels", "update")?.payload).toEqual(expect.objectContaining({ footage: null }));
  });

  it("tracks storage_id on uploaded clips and rejects cross-workspace reuse", async () => {
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("upload_claims", { data: { id: "cl1", workspace_id: "other-ws" } });
    await expect(saveUpload({ workspaceId: "ws1", storageId: "abc-123", name: "interview.mp4", size: 1024 })).rejects.toThrow(
      /another workspace/,
    );

    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("upload_claims", { data: null });
    fake().queue("footage_clips", { data: { id: "clip-9" } });
    const clipId = await saveUpload({ workspaceId: "ws1", storageId: "abc-123", name: "interview.mp4", size: 1024000 });
    expect(clipId).toBe("clip-9");
    expect(fake().lastCall("footage_clips", "insert")?.payload).toEqual(expect.objectContaining({
      workspace_id: "ws1",
      storage_id: "abc-123",
      name: "interview.mp4",
    }));
  });
});
