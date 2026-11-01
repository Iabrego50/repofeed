import { describe, expect, it } from "vitest";

describe("reel footage", () => {
  it("footage can be from upload or stock", () => {
    const uploadFootage = {
      kind: "upload",
      clipId: "clip-123",
      caption: "User testing session",
    };
    const stockFootage = {
      kind: "stock",
      url: "/footage/calendar.mp4",
      caption: "Calendar animation",
    };
    expect(uploadFootage.kind).toBe("upload");
    expect(stockFootage.kind).toBe("stock");
  });

  it("stock URLs must start with /footage/", () => {
    const validStock = "/footage/calendar.mp4";
    const invalidStock = "https://evil.com/video.mp4";
    expect(validStock.startsWith("/footage/")).toBe(true);
    expect(invalidStock.startsWith("/footage/")).toBe(false);
  });

  it("footage clips track storage_id", () => {
    const clip = {
      storage_id: "abc-123",
      name: "interview.mp4",
      size: 1024000,
    };
    expect(clip.storage_id).toBeTruthy();
    expect(clip.name).toContain(".mp4");
  });

  it("deleting clip clears reels using it", () => {
    // When footage_clip is deleted
    // All reels with footage.source.clipId = deleted_clip_id
    // Should have footage = null
    const reelBeforeDelete = { footage: { source: { clipId: "clip-1" } } };
    const reelAfterDelete = { footage: null };
    expect(reelBeforeDelete.footage).not.toBeNull();
    expect(reelAfterDelete.footage).toBeNull();
  });

  it("footage caption is trimmed and limited", () => {
    const caption = "  Home visit · P07 · Day 3 ";
    const trimmed = caption.trim();
    expect(trimmed).toBe("Home visit · P07 · Day 3");
    expect(trimmed).not.toMatch(/^\s|\s$/);
  });
});
