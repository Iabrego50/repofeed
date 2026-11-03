import { STOCK_CLIPS } from "../reel/stock-clips.js";
import { nextAttemptAtIso } from "./async-jobs.js";

export const VIDEO_BUCKET = "videos";
export const DEFAULT_VIDEO_MODEL = "grok-imagine-video-1.5-lite";
export const DEFAULT_VIDEO_SECONDS = 5;
export const DEFAULT_VIDEO_SIZE = "720x1280";
export const DEFAULT_VIDEO_RESOLUTION = "720p";
export const DEFAULT_VIDEO_ASPECT_RATIO = "9:16";
export const DEFAULT_VIDEO_CONCURRENCY = 2;
export const MAX_VIDEO_ATTEMPTS = 4;
export const VIDEO_PROCESS_BATCH = 8;

export const PLAN_VIDEO_CAPS = {
  free: 6,
  pro: 12,
  team: 24,
} as const;

export type VideoPlan = keyof typeof PLAN_VIDEO_CAPS;

export type ReelVideoStatus =
  "queued" | "starting" | "in_progress" | "completed" | "failed" | "skipped";

export type ReelVideoProvider = "xai" | "openai";

export type ReelVideo = {
  status: ReelVideoStatus;
  provider: ReelVideoProvider;
  jobId?: string;
  model?: string;
  prompt?: string;
  attempts: number;
  nextAttemptAt?: string;
  error?: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  storageId?: string;
  bucket?: string;
};

export type FootageMedia = "image" | "video";

export type ReelFootageLike = {
  url?: string;
  caption?: string;
  media?: FootageMedia | string;
  storageId?: string;
  bucket?: string;
  source?: { kind?: string; url?: string; clipId?: string };
} | null;

export type ReelVideoRow = {
  id: string;
  study_id: string;
  workspace_id: string;
  title: string;
  track: string;
  track_index: number;
  scenes: unknown;
  footage: ReelFootageLike;
  art?: { status?: string; url?: string } | null;
  video?: ReelVideo | null;
  enabled?: boolean;
};

export function envFlag(
  name: string,
  defaultValue = true,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = String(env[name] ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return defaultValue;
  if (["0", "false", "off", "no"].includes(raw)) return false;
  if (["1", "true", "on", "yes"].includes(raw)) return true;
  return defaultValue;
}

function firstEnv(env: NodeJS.ProcessEnv, ...names: string[]): string {
  for (const name of names) {
    const value = String(env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export function videoProviderName(
  env: NodeJS.ProcessEnv = process.env,
): ReelVideoProvider {
  const raw = firstEnv(env, "VIDEO_PROVIDER").toLowerCase();
  if (raw === "openai") return "openai";
  return "xai";
}

export function videoGenerationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (firstEnv(env, "VIDEO_ENABLED"))
    return envFlag("VIDEO_ENABLED", true, env);
  return envFlag("OPENAI_VIDEO_ENABLED", true, env);
}

export function videoModel(env: NodeJS.ProcessEnv = process.env): string {
  return (
    firstEnv(env, "VIDEO_MODEL", "OPENAI_VIDEO_MODEL") || DEFAULT_VIDEO_MODEL
  );
}

export function videoSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = firstEnv(env, "VIDEO_SECONDS", "OPENAI_VIDEO_SECONDS");
  const n = Number(raw || DEFAULT_VIDEO_SECONDS);
  if (Number.isFinite(n) && n >= 1 && n <= 15) return Math.round(n);
  return DEFAULT_VIDEO_SECONDS;
}

export function videoSize(env: NodeJS.ProcessEnv = process.env): string {
  const raw = firstEnv(env, "VIDEO_SIZE", "OPENAI_VIDEO_SIZE");
  return raw || DEFAULT_VIDEO_SIZE;
}

export function videoResolution(
  env: NodeJS.ProcessEnv = process.env,
): "480p" | "720p" | "1080p" {
  const raw =
    firstEnv(env, "VIDEO_RESOLUTION") ||
    videoSize(env) ||
    DEFAULT_VIDEO_RESOLUTION;
  if (/1080/.test(raw)) return "1080p";
  if (/480/.test(raw)) return "480p";
  return "720p";
}

export function videoAspectRatio(env: NodeJS.ProcessEnv = process.env): string {
  const raw = firstEnv(env, "VIDEO_ASPECT_RATIO");
  if (raw) return raw;
  const size = videoSize(env);
  if (size === "1280x720" || size === "1920x1080") return "16:9";
  return DEFAULT_VIDEO_ASPECT_RATIO;
}

export function videoConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(
    firstEnv(env, "VIDEO_CONCURRENCY", "OPENAI_VIDEO_CONCURRENCY"),
  );
  if (Number.isFinite(n) && n >= 1) return Math.min(4, Math.floor(n));
  return DEFAULT_VIDEO_CONCURRENCY;
}

export function studyVideoCap(
  plan: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = firstEnv(env, "VIDEO_STUDY_CAP", "OPENAI_VIDEO_STUDY_CAP");
  if (raw) {
    const override = Number(raw);
    if (Number.isFinite(override) && override >= 0) return Math.floor(override);
  }
  if (plan === "team") return PLAN_VIDEO_CAPS.team;
  if (plan === "pro") return PLAN_VIDEO_CAPS.pro;
  return PLAN_VIDEO_CAPS.free;
}

export function stockClipForIndex(index: number): (typeof STOCK_CLIPS)[number] {
  const i = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return STOCK_CLIPS[i % STOCK_CLIPS.length];
}

export function stockFootageForIndex(index: number): {
  url: string;
  caption: string;
  source: { kind: "stock"; url: string };
} {
  const clip = stockClipForIndex(index);
  return {
    url: clip.url,
    caption: clip.label,
    source: { kind: "stock", url: clip.url },
  };
}

export function isStockFootage(footage: ReelFootageLike): boolean {
  if (!footage) return false;
  if (footage.source?.kind === "stock") return true;
  return typeof footage.url === "string" && footage.url.startsWith("/footage/");
}

export function isUserUpload(footage: ReelFootageLike): boolean {
  return footage?.source?.kind === "upload";
}

export function hasAiVideo(
  footage: ReelFootageLike,
  video?: ReelVideo | null,
): boolean {
  if (
    video?.status === "completed" &&
    (video.storageId || footage?.media === "video")
  )
    return true;
  if (!footage) return false;
  if (
    footage.media === "video" &&
    (footage.bucket === VIDEO_BUCKET || footage.source?.kind === "ai")
  ) {
    return true;
  }
  return false;
}

export function needsAiVideo(
  row: Pick<ReelVideoRow, "footage" | "video">,
): boolean {
  if (hasAiVideo(row.footage, row.video)) return false;
  if (isUserUpload(row.footage)) return false;
  if (row.video?.status === "skipped") return false;
  if (
    row.video?.status === "failed" &&
    (row.video.attempts ?? 0) >= MAX_VIDEO_ATTEMPTS
  )
    return false;
  return true;
}

export function countsTowardCap(
  row: Pick<ReelVideoRow, "footage" | "video">,
): boolean {
  if (hasAiVideo(row.footage, row.video)) return true;
  const status = row.video?.status;
  return (
    status === "queued" || status === "starting" || status === "in_progress"
  );
}

export function shouldStartJob(
  video: ReelVideo | null | undefined,
  now = Date.now(),
): boolean {
  if (!video) return false;
  if (video.status === "queued") return true;
  if (video.status === "failed" && (video.attempts ?? 0) < MAX_VIDEO_ATTEMPTS) {
    if (!video.nextAttemptAt) return true;
    return Date.parse(video.nextAttemptAt) <= now;
  }
  return false;
}

export function shouldPollJob(video: ReelVideo | null | undefined): boolean {
  return Boolean(
    video?.jobId &&
    (video.status === "starting" || video.status === "in_progress"),
  );
}

export function queuedVideoState(
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): ReelVideo {
  return {
    status: "queued",
    provider: videoProviderName(env),
    attempts: 0,
    updatedAt: new Date(now).toISOString(),
  };
}

export function startingVideoState(
  previous: ReelVideo | null | undefined,
  now = Date.now(),
): ReelVideo {
  return {
    ...(previous ?? queuedVideoState(now)),
    status: "starting",
    attempts: (previous?.attempts ?? 0) + 1,
    startedAt: previous?.startedAt ?? new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    error: undefined,
  };
}

export function inProgressVideoState(
  previous: ReelVideo,
  jobId: string,
  extras: {
    model?: string;
    prompt?: string;
    provider?: ReelVideoProvider;
  } = {},
  now = Date.now(),
): ReelVideo {
  return {
    ...previous,
    status: "in_progress",
    jobId,
    provider: extras.provider ?? previous.provider,
    model: extras.model ?? previous.model,
    prompt: extras.prompt ?? previous.prompt,
    updatedAt: new Date(now).toISOString(),
  };
}

export function completedVideoState(
  previous: ReelVideo,
  extras: { storageId: string; jobId?: string },
  now = Date.now(),
): ReelVideo {
  return {
    ...previous,
    status: "completed",
    jobId: extras.jobId ?? previous.jobId,
    storageId: extras.storageId,
    bucket: VIDEO_BUCKET,
    completedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    error: undefined,
    nextAttemptAt: undefined,
  };
}

export function failedVideoState(
  previous: ReelVideo | null | undefined,
  error: string,
  now = Date.now(),
  retryAfterHeader?: string | null,
): ReelVideo {
  const attempts = previous?.attempts ?? 1;
  const retry = attempts < MAX_VIDEO_ATTEMPTS;
  return {
    ...(previous ?? queuedVideoState(now)),
    status: "failed",
    attempts,
    error: error.slice(0, 500),
    updatedAt: new Date(now).toISOString(),
    nextAttemptAt: retry
      ? nextAttemptAtIso(Math.max(0, attempts - 1), now, retryAfterHeader)
      : undefined,
  };
}

export function skippedVideoState(
  reason: string,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): ReelVideo {
  return {
    status: "skipped",
    provider: videoProviderName(env),
    attempts: 0,
    error: reason.slice(0, 500),
    updatedAt: new Date(now).toISOString(),
  };
}

export function fallbackFootageFor(
  row: Pick<ReelVideoRow, "footage" | "track_index">,
): NonNullable<ReelFootageLike> {
  if (isUserUpload(row.footage))
    return row.footage as NonNullable<ReelFootageLike>;
  if (isStockFootage(row.footage) && row.footage?.url) return row.footage;
  return stockFootageForIndex(row.track_index);
}

function sceneWords(scenes: unknown): string {
  if (!Array.isArray(scenes)) return "";
  return scenes
    .map((scene) => {
      if (!scene || typeof scene !== "object") return "";
      return Object.values(scene as Record<string, unknown>)
        .flat()
        .filter((value) => typeof value === "string")
        .join(" ");
    })
    .join(" / ")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function buildVideoPrompt(
  row: Pick<ReelVideoRow, "title" | "track" | "scenes">,
): string {
  const script = sceneWords(row.scenes);
  return [
    `Vertical 9:16 documentary B-roll for a research insight reel titled "${row.title}"`,
    row.track ? `(track: ${row.track}).` : ".",
    script ? `The reel is about: ${script}.` : "",
    "Slow handheld observational footage of the everyday place, object or moment the finding is about.",
    "Photorealistic, muted colors, practical light, subtle film grain, calm darker upper half.",
    "No text, letters, numbers, logos, readable screens or identifiable faces.",
    "People only from behind, as hands, silhouettes, or out of focus.",
    "No generic stock tropes (handshakes, lightbulbs, charts, office teams).",
  ]
    .filter(Boolean)
    .join(" ");
}

export function videoStoragePath(reelId: string, at = Date.now()): string {
  return `${reelId}/${at}.mp4`;
}

export function videoCaption(
  row: Pick<ReelVideoRow, "title" | "footage">,
): string {
  const existing = row.footage?.caption?.trim();
  if (existing) return existing.slice(0, 40);
  return row.title.trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 40);
}
