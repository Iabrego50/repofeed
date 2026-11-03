import { describe, expect, it } from "vitest";
import { STOCK_CLIPS } from "../reel/stock-clips";
import {
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_SECONDS,
  PLAN_VIDEO_CAPS,
  buildVideoPrompt,
  countsTowardCap,
  failedVideoState,
  fallbackFootageFor,
  hasAiVideo,
  needsAiVideo,
  queuedVideoState,
  shouldPollJob,
  shouldStartJob,
  stockClipForIndex,
  studyVideoCap,
  videoGenerationEnabled,
  videoModel,
  videoResolution,
  videoSeconds,
} from "./reel-video";

describe("reel AI video policy", () => {
  it("rotates the 10 stock clips as a fallback so a reel is never blank", () => {
    expect(STOCK_CLIPS).toHaveLength(10);
    expect(stockClipForIndex(0).url).toBe("/footage/receipts.mp4");
    expect(stockClipForIndex(10).url).toBe("/footage/receipts.mp4");
    expect(fallbackFootageFor({ footage: null, track_index: 3 }).url).toBe(
      "/footage/calendar.mp4",
    );
    expect(
      fallbackFootageFor({
        footage: {
          url: "/footage/mushrooms.mp4",
          source: { kind: "stock", url: "/footage/mushrooms.mp4" },
        },
        track_index: 0,
      }).url,
    ).toBe("/footage/mushrooms.mp4");
  });

  it("never regenerates an existing AI video or a user upload", () => {
    expect(
      hasAiVideo({
        media: "video",
        bucket: "videos",
        url: "https://proj.supabase.co/storage/v1/object/public/videos/r/1.mp4",
        source: { kind: "ai" },
      }),
    ).toBe(true);
    expect(
      needsAiVideo({
        footage: { media: "video", bucket: "videos", source: { kind: "ai" } },
        video: {
          status: "completed",
          provider: "openai",
          attempts: 1,
          updatedAt: "",
        },
      }),
    ).toBe(false);
    expect(
      needsAiVideo({
        footage: {
          source: { kind: "upload", clipId: "clip-1" },
          url: "private",
        },
        video: null,
      }),
    ).toBe(false);
    expect(needsAiVideo({ footage: null, video: null })).toBe(true);
    expect(
      needsAiVideo({
        footage: { media: "image", url: "https://x/art.png" },
        video: null,
      }),
    ).toBe(true);
  });

  it("honors the kill switch and per-plan study caps", () => {
    expect(videoGenerationEnabled({})).toBe(true);
    expect(videoGenerationEnabled({ OPENAI_VIDEO_ENABLED: "false" })).toBe(
      false,
    );
    expect(videoGenerationEnabled({ OPENAI_VIDEO_ENABLED: "0" })).toBe(false);
    expect(videoGenerationEnabled({ VIDEO_ENABLED: "false" })).toBe(false);
    expect(studyVideoCap("free")).toBe(PLAN_VIDEO_CAPS.free);
    expect(studyVideoCap("pro")).toBe(PLAN_VIDEO_CAPS.pro);
    expect(studyVideoCap("team")).toBe(PLAN_VIDEO_CAPS.team);
    expect(studyVideoCap("pro", { OPENAI_VIDEO_STUDY_CAP: "3" })).toBe(3);
    expect(countsTowardCap({ footage: null, video: queuedVideoState() })).toBe(
      true,
    );
    expect(queuedVideoState(0).provider).toBe("xai");
    expect(videoModel({})).toBe(DEFAULT_VIDEO_MODEL);
    expect(videoSeconds({})).toBe(DEFAULT_VIDEO_SECONDS);
    expect(videoResolution({})).toBe("720p");
  });

  it("starts queued jobs and retries failed ones after backoff", () => {
    const queued = queuedVideoState(0);
    expect(shouldStartJob(queued, 1)).toBe(true);
    expect(
      shouldPollJob({ ...queued, status: "in_progress", jobId: "video_1" }),
    ).toBe(true);
    const failed = failedVideoState(queued, "rate limited", 0, "2");
    expect(failed.status).toBe("failed");
    expect(shouldStartJob(failed, 0)).toBe(false);
    expect(shouldStartJob(failed, Date.parse(failed.nextAttemptAt!))).toBe(
      true,
    );
  });

  it("builds a vertical documentary prompt from the reel script", () => {
    const prompt = buildVideoPrompt({
      title: "Why people really leave",
      track: "By the numbers",
      scenes: [
        { type: "hook", text: "Why do subscribers *actually* cancel?" },
        { type: "stat", num: "29%", label: "too expensive" },
      ],
    });
    expect(prompt).toMatch(/Why people really leave/);
    expect(prompt).toMatch(/9:16/);
    expect(prompt).toMatch(/No text/);
    expect(prompt).not.toMatch(/\*/);
  });
});
