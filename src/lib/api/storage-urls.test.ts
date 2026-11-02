import { describe, expect, it } from "vitest";
import { mapReel } from "./mappers";
import {
  ART_BUCKET,
  artStoragePath,
  hydrateFootageMedia,
  isPrivateBucketPublicUrl,
  paintedArtFields,
  parseStoragePublicUrl,
  publicObjectUrl,
  publicStorageOrigin,
} from "./storage-urls";

const ORIGIN = "https://proj.supabase.co";

describe("art storage URLs", () => {
  it("builds public URLs only for the art bucket", () => {
    const path = artStoragePath("reel-1", 1700000000000);
    expect(path).toBe("reel-1/1700000000000.png");
    expect(publicObjectUrl(ORIGIN, ART_BUCKET, path)).toBe(
      "https://proj.supabase.co/storage/v1/object/public/art/reel-1/1700000000000.png",
    );
    const painted = paintedArtFields({ origin: ORIGIN, storageId: path, caption: "Kitchen, weeknight" });
    expect(painted.footage).toEqual({
      url: "https://proj.supabase.co/storage/v1/object/public/art/reel-1/1700000000000.png",
      storageId: path,
      bucket: "art",
      caption: "Kitchen, weeknight",
      media: "image",
    });
    expect(painted.art).toEqual({
      status: "completed",
      url: painted.footage.url,
      storageId: path,
      bucket: "art",
      caption: "Kitchen, weeknight",
    });
    expect(painted.footage.url).not.toMatch(/\/uploads\/|\/footage\/|\/generated\//);
  });

  it("treats /object/public URLs to private buckets as unusable", () => {
    expect(
      isPrivateBucketPublicUrl(`${ORIGIN}/storage/v1/object/public/uploads/art-reel.png`),
    ).toBe(true);
    expect(
      isPrivateBucketPublicUrl(`${ORIGIN}/storage/v1/object/public/footage/clip.mp4`),
    ).toBe(true);
    expect(
      isPrivateBucketPublicUrl(`${ORIGIN}/storage/v1/object/public/generated/still.png`),
    ).toBe(true);
    expect(isPrivateBucketPublicUrl(`${ORIGIN}/storage/v1/object/public/art/reel-1/1.png`)).toBe(false);
    expect(isPrivateBucketPublicUrl("/footage/calendar.mp4")).toBe(false);
    expect(parseStoragePublicUrl(`${ORIGIN}/storage/v1/object/public/uploads/art-1.png`)).toEqual({
      bucket: "uploads",
      path: "art-1.png",
    });
  });

  it("rebuilds art URLs from the stored path and leaves stock clips alone", () => {
    expect(hydrateFootageMedia({ url: "/footage/calendar.mp4", caption: "stock" }, ORIGIN)).toEqual({
      url: "/footage/calendar.mp4",
      caption: "stock",
    });
    expect(
      hydrateFootageMedia(
        { url: `${ORIGIN}/storage/v1/object/public/uploads/old.png`, storageId: "reel/1.png", bucket: "art", media: "image" },
        ORIGIN,
      ),
    ).toEqual({
      url: `${ORIGIN}/storage/v1/object/public/art/reel/1.png`,
      storageId: "reel/1.png",
      bucket: "art",
      media: "image",
    });
    expect(publicStorageOrigin({ SUPABASE_URL: `${ORIGIN}/` })).toBe(ORIGIN);
  });

  it("mapReel rebuilds public art URLs from the stored path", () => {
    const origin = publicStorageOrigin();
    expect(origin).toMatch(/^https?:\/\//);
    const reel = mapReel({
      id: "reel-1",
      workspace_id: "ws-1",
      study_id: "study-1",
      position: 0,
      track: "t",
      track_index: 0,
      title: "Dinner",
      scenes: [],
      finding_ids: [],
      source_names: [],
      footage: {
        url: `${origin}/storage/v1/object/public/uploads/stale.png`,
        storageId: "reel-1/1.png",
        bucket: "art",
        caption: "Kitchen",
        media: "image",
      },
      warning: null,
      enabled: true,
      created_at: "2026-11-02T00:00:00.000Z",
      updated_at: "2026-11-02T00:00:00.000Z",
    });
    expect(reel.footage?.url).toBe(`${origin}/storage/v1/object/public/art/reel-1/1.png`);
    expect(reel.footage?.storageId).toBe("reel-1/1.png");
    expect(reel.footage?.bucket).toBe("art");
    expect(reel.footage?.url).not.toMatch(/\/uploads\//);
  });
});
