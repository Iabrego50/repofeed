import { describe, expect, it } from "vitest";
import { RetryableHttpError } from "./async-jobs";
import {
  composeReelVideoFields,
  enqueueReelVideos,
  processReelVideos,
  type ReelVideoStore,
} from "./reel-video-jobs";
import {
  queuedVideoState,
  type ReelVideo,
  type ReelVideoRow,
} from "./reel-video";
import type { VideoProvider } from "../ai/videos";

function row(partial: Partial<ReelVideoRow> & { id: string }): ReelVideoRow {
  return {
    study_id: "study-1",
    workspace_id: "ws-1",
    title: "Why people really leave",
    track: "By the numbers",
    track_index: 0,
    scenes: [{ type: "hook", text: "Why do people leave?" }],
    footage: null,
    video: null,
    enabled: true,
    ...partial,
  };
}

function memoryStore(
  seed: ReelVideoRow[],
  plan: string | null = "pro",
): ReelVideoStore & { rows: ReelVideoRow[] } {
  const rows = seed.map((r) => ({ ...r }));
  return {
    rows,
    listByStudy: async (studyId) => rows.filter((r) => r.study_id === studyId),
    listPending: async (limit) =>
      rows
        .filter((r) =>
          ["queued", "starting", "in_progress", "failed"].includes(
            r.video?.status ?? "",
          ),
        )
        .slice(0, limit),
    listEligible: async (args) =>
      rows
        .filter((r) => (args.studyId ? r.study_id === args.studyId : true))
        .filter((r) => (args.reelId ? r.id === args.reelId : true))
        .filter((r) =>
          args.titleContains
            ? r.title.toLowerCase().includes(args.titleContains.toLowerCase())
            : true,
        )
        .slice(0, args.limit),
    updateReel: async (id, patch) => {
      const found = rows.find((r) => r.id === id);
      if (!found) throw new Error("missing reel");
      if (patch.footage !== undefined)
        found.footage = patch.footage as ReelVideoRow["footage"];
      if (patch.video !== undefined) found.video = patch.video;
    },
    workspacePlan: async () => plan,
    uploadVideo: async () => undefined,
  };
}

function providerMock(overrides: Partial<VideoProvider> = {}): VideoProvider {
  return {
    id: "xai",
    create: async () => ({ id: "video_1", status: "queued" }),
    retrieve: async () => ({ id: "video_1", status: "completed" }),
    download: async () => new Uint8Array([1, 2, 3, 4]),
    ...overrides,
  };
}

describe("reel video job lifecycle", () => {
  it("enqueues a stock fallback and then completes an xAI video onto public storage", async () => {
    const store = memoryStore([row({ id: "reel-1" })]);
    const env = {
      OPENAI_VIDEO_ENABLED: "true",
      SUPABASE_URL: "https://proj.supabase.co",
    };

    const queued = await enqueueReelVideos(store, {
      studyId: "study-1",
      env,
      now: 1_700_000_000_000,
    });
    expect(queued.queued).toBe(1);
    expect(store.rows[0].footage?.url).toBe("/footage/receipts.mp4");
    expect(store.rows[0].video?.status).toBe("queued");
    expect(store.rows[0].video?.provider).toBe("xai");

    const processed = await processReelVideos(store, providerMock(), {
      studyId: "study-1",
      env,
      now: 1_700_000_000_100,
    });
    expect(processed.started).toBe(1);
    expect(store.rows[0].video?.status).toBe("in_progress");
    expect(store.rows[0].video?.provider).toBe("xai");
    expect(store.rows[0].video?.jobId).toBe("video_1");
    expect(store.rows[0].footage?.url).toBe("/footage/receipts.mp4");

    const finished = await processReelVideos(store, providerMock(), {
      studyId: "study-1",
      env,
      now: 1_700_000_000_200,
    });
    expect(finished.completed).toBe(1);
    expect(store.rows[0].video?.status).toBe("completed");
    expect(store.rows[0].footage).toMatchObject({
      media: "video",
      bucket: "videos",
      source: { kind: "ai" },
    });
    expect(String(store.rows[0].footage?.url)).toContain(
      "/storage/v1/object/public/videos/",
    );
  });

  it("does not enqueue a second video when one already exists", async () => {
    const store = memoryStore([
      row({
        id: "reel-1",
        footage: {
          media: "video",
          bucket: "videos",
          source: { kind: "ai" },
          url: "https://x/v.mp4",
        },
        video: {
          status: "completed",
          provider: "openai",
          attempts: 1,
          updatedAt: "",
          storageId: "reel-1/1.mp4",
        },
      }),
    ]);
    const result = await enqueueReelVideos(store, { studyId: "study-1" });
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("retries a 429 on create, then records a later failure and keeps the stock clip", async () => {
    const store = memoryStore([
      row({
        id: "reel-1",
        footage: {
          url: "/footage/receipts.mp4",
          source: { kind: "stock", url: "/footage/receipts.mp4" },
        },
        video: queuedVideoState(0),
      }),
    ]);
    let createCalls = 0;
    const provider = providerMock({
      create: async () => {
        createCalls += 1;
        throw new RetryableHttpError(429, "rate limited", "0");
      },
    });
    const first = await processReelVideos(store, provider, {
      studyId: "study-1",
      now: 10,
    });
    expect(first.failed).toBe(1);
    expect(createCalls).toBeGreaterThanOrEqual(1);
    expect(store.rows[0].video?.status).toBe("failed");
    expect(store.rows[0].footage?.url).toBe("/footage/receipts.mp4");
  });

  it("skips create when the kill switch is off and still applies stock fallback", async () => {
    const store = memoryStore([row({ id: "reel-1" })]);
    const env = { OPENAI_VIDEO_ENABLED: "false" };
    const result = await enqueueReelVideos(store, {
      studyId: "study-1",
      env,
      now: 1,
    });
    expect(result.queued).toBe(0);
    expect(store.rows[0].video?.status).toBe("skipped");
    expect(store.rows[0].footage?.url).toMatch(/^\/footage\//);
  });

  it("backfills the named Why people really leave reel", async () => {
    const store = memoryStore([
      row({
        id: "reel-leave",
        title: "Why people really leave",
        footage: {
          media: "image",
          url: "https://proj.supabase.co/storage/v1/object/public/art/missing.png",
        },
      }),
      row({
        id: "reel-other",
        title: "Help that became homework",
        track_index: 1,
      }),
    ]);
    const result = await enqueueReelVideos(store, {
      titleContains: "Why people really leave",
      now: 1,
    });
    expect(result.queued).toBe(1);
    expect(store.rows[0].footage?.url).toMatch(/^\/footage\//);
    expect(store.rows[0].video?.status).toBe("queued");
    expect(store.rows[1].video).toBeNull();
  });

  it("skips compose when the study is already at the video cap", () => {
    const queued = composeReelVideoFields(0, 1, {}, { withinCap: true, cap: 6 });
    expect(queued.video.status).toBe("queued");
    const skipped = composeReelVideoFields(6, 1, {}, { withinCap: false, cap: 6 });
    expect(skipped.video.status).toBe("skipped");
    expect(skipped.video.error).toMatch(/cap reached \(6\)/);
    expect(skipped.footage?.url).toMatch(/^\/footage\//);
  });

  it("does not start more videos than the plan cap during process", async () => {
    const store = memoryStore(
      [
        row({ id: "r1", video: queuedVideoState(0), track_index: 0 }),
        row({ id: "r2", video: queuedVideoState(0), track_index: 1 }),
        row({ id: "r3", video: queuedVideoState(0), track_index: 2 }),
      ],
      "free",
    );
    const result = await processReelVideos(store, providerMock(), {
      studyId: "study-1",
      env: { VIDEO_STUDY_CAP: "2", VIDEO_ENABLED: "true" },
      now: 20,
    });
    expect(result.started).toBe(2);
    expect(result.skipped).toBe(1);
    expect(store.rows.filter((r) => r.video?.status === "starting" || r.video?.status === "in_progress")).toHaveLength(2);
    expect(store.rows[2].video?.status).toBe("skipped");
  });

  it("respects the per-study cap", async () => {
    const existing: ReelVideo = {
      status: "completed",
      provider: "openai",
      attempts: 1,
      updatedAt: "",
      storageId: "x",
    };
    const store = memoryStore(
      [
        row({
          id: "r1",
          footage: { media: "video", bucket: "videos", source: { kind: "ai" } },
          video: existing,
        }),
        row({ id: "r2", title: "Next reel", track_index: 1 }),
      ],
      "free",
    );
    const result = await enqueueReelVideos(store, {
      studyId: "study-1",
      env: { OPENAI_VIDEO_STUDY_CAP: "1" },
      now: 1,
    });
    expect(result.queued).toBe(0);
    expect(store.rows[1].video?.status).toBe("skipped");
    expect(store.rows[1].footage?.url).toMatch(/^\/footage\//);
  });

  it("fails leftover OpenAI jobs so the next pass can start on xAI", async () => {
    const store = memoryStore([
      row({
        id: "reel-1",
        footage: {
          url: "/footage/receipts.mp4",
          source: { kind: "stock", url: "/footage/receipts.mp4" },
        },
        video: {
          status: "in_progress",
          provider: "openai",
          jobId: "video_old",
          attempts: 1,
          updatedAt: "",
        },
      }),
    ]);
    const provider = providerMock({
      retrieve: async () => {
        throw new Error("should not poll OpenAI");
      },
    });
    const result = await processReelVideos(store, provider, {
      studyId: "study-1",
      now: 10,
    });
    expect(result.failed).toBe(1);
    expect(store.rows[0].video?.status).toBe("failed");
    expect(store.rows[0].video?.error).toMatch(/shut down on 2026-09-24/);
    expect(store.rows[0].footage?.url).toBe("/footage/receipts.mp4");
  });
});
