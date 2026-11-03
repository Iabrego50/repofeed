import { RetryableHttpError, retryWithBackoff } from "../api/async-jobs.js";
import { ServerNotConfiguredError } from "../server-env.js";
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_RESOLUTION,
  DEFAULT_VIDEO_SECONDS,
} from "../api/reel-video.js";

export type VideoProviderId = "xai" | "openai";

export type VideoStatus = "queued" | "in_progress" | "completed" | "failed";

export type VideoJob = {
  id: string;
  status: VideoStatus;
  progress?: number;
  model?: string;
  error?: { message?: string; code?: string } | null;
  videoUrl?: string;
};

export type CreateVideoArgs = {
  prompt: string;
  model?: string;
  seconds?: number | string;
  size?: string;
  resolution?: string;
  aspectRatio?: string;
  imageUrl?: string;
};

export type VideoProvider = {
  id: VideoProviderId;
  create: (args: CreateVideoArgs, env?: NodeJS.ProcessEnv) => Promise<VideoJob>;
  retrieve: (jobId: string, env?: NodeJS.ProcessEnv) => Promise<VideoJob>;
  download: (jobId: string, env?: NodeJS.ProcessEnv) => Promise<Uint8Array>;
};

export const OPENAI_VIDEOS_SHUTDOWN_MESSAGE =
  "OpenAI Videos API was shut down on 2026-09-24";

const DEFAULT_XAI_BASE = "https://api.x.ai/v1";

export function videoProviderId(
  env: NodeJS.ProcessEnv = process.env,
): VideoProviderId {
  const raw = String(env.VIDEO_PROVIDER ?? "")
    .trim()
    .toLowerCase();
  if (raw === "openai") return "openai";
  return "xai";
}

export function xaiVideoBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const override = String(env.XAI_VIDEO_BASE_URL || env.XAI_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  return override || DEFAULT_XAI_BASE;
}

function xaiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.XAI_API_KEY ?? "").trim();
  if (!value) throw new ServerNotConfiguredError("XAI_API_KEY");
  return value;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return response.statusText || `HTTP ${response.status}`;
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };
    return json.error?.message || json.message || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

async function xaiFetch(
  path: string,
  init: RequestInit,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const response = await fetchImpl(`${xaiVideoBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${xaiApiKey(env)}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new RetryableHttpError(
      response.status,
      message,
      response.headers.get("retry-after") ?? undefined,
    );
  }
  return response;
}

function mapVideoStatus(raw: unknown): VideoStatus {
  const status = String(raw || "")
    .trim()
    .toLowerCase();
  if (
    status === "done" ||
    status === "completed" ||
    status === "succeeded" ||
    status === "success"
  ) {
    return "completed";
  }
  if (
    status === "failed" ||
    status === "expired" ||
    status === "error" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "failed";
  }
  if (status === "queued") return "queued";
  return "in_progress";
}

function jobError(payload: Record<string, unknown>): VideoJob["error"] {
  const error = payload.error;
  if (!error || typeof error !== "object") return null;
  const row = error as { message?: unknown; code?: unknown };
  return {
    message: String(row.message ?? "Video generation failed"),
    code: row.code ? String(row.code) : undefined,
  };
}

function parseCreateJob(payload: unknown): VideoJob {
  if (!payload || typeof payload !== "object") {
    throw new Error("Video API returned no job");
  }
  const row = payload as Record<string, unknown>;
  const id =
    (typeof row.request_id === "string" && row.request_id) ||
    (typeof row.id === "string" && row.id) ||
    "";
  if (!id) throw new Error("Video API returned no job id");
  return {
    id,
    status: row.status ? mapVideoStatus(row.status) : "queued",
    progress: typeof row.progress === "number" ? row.progress : undefined,
    model: typeof row.model === "string" ? row.model : undefined,
  };
}

function parseRetrieveJob(payload: unknown): VideoJob {
  if (!payload || typeof payload !== "object") {
    throw new Error("Video API returned no job");
  }
  const row = payload as Record<string, unknown>;
  const id =
    (typeof row.request_id === "string" && row.request_id) ||
    (typeof row.id === "string" && row.id) ||
    "";
  if (!id) throw new Error("Video API returned no job id");

  const video =
    row.video && typeof row.video === "object"
      ? (row.video as {
          url?: unknown;
          respect_moderation?: unknown;
        })
      : null;
  const videoUrl = typeof video?.url === "string" ? video.url.trim() : "";
  const status = mapVideoStatus(row.status);
  if (status === "completed") {
    if (video?.respect_moderation === false || !videoUrl) {
      return {
        id,
        status: "failed",
        model: typeof row.model === "string" ? row.model : undefined,
        error: {
          message:
            video?.respect_moderation === false
              ? "Video failed moderation"
              : "Video had no download URL",
        },
      };
    }
    return {
      id,
      status: "completed",
      progress: typeof row.progress === "number" ? row.progress : 100,
      model: typeof row.model === "string" ? row.model : undefined,
      videoUrl,
      error: null,
    };
  }

  return {
    id,
    status,
    progress: typeof row.progress === "number" ? row.progress : undefined,
    model: typeof row.model === "string" ? row.model : undefined,
    error: jobError(row),
  };
}

function durationSeconds(args: CreateVideoArgs): number {
  const n = Number(args.seconds ?? DEFAULT_VIDEO_SECONDS);
  if (Number.isFinite(n) && n >= 1 && n <= 15) return Math.round(n);
  return DEFAULT_VIDEO_SECONDS;
}

function resolutionFromArgs(args: CreateVideoArgs): "480p" | "720p" | "1080p" {
  const raw = String(args.resolution || args.size || DEFAULT_VIDEO_RESOLUTION);
  if (/1080/.test(raw)) return "1080p";
  if (/480/.test(raw)) return "480p";
  return "720p";
}

export async function createXaiVideo(
  args: CreateVideoArgs,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoJob> {
  const body: Record<string, unknown> = {
    model: args.model || DEFAULT_VIDEO_MODEL,
    prompt: args.prompt,
    duration: durationSeconds(args),
    aspect_ratio: args.aspectRatio || DEFAULT_VIDEO_ASPECT_RATIO,
    resolution: resolutionFromArgs(args),
    generate_audio: false,
  };
  if (args.imageUrl) {
    body.image = { url: args.imageUrl };
  }

  return retryWithBackoff(async () => {
    const response = await xaiFetch(
      "/videos/generations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      env,
      fetchImpl,
    );
    return parseCreateJob(await response.json());
  });
}

export async function retrieveXaiVideo(
  videoId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoJob> {
  return retryWithBackoff(async () => {
    const response = await xaiFetch(
      `/videos/${encodeURIComponent(videoId)}`,
      { method: "GET" },
      env,
      fetchImpl,
    );
    return parseRetrieveJob({
      ...((await response.json()) as object),
      request_id: videoId,
    });
  });
}

export async function downloadXaiVideo(
  videoId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const job = await retrieveXaiVideo(videoId, env, fetchImpl);
  if (job.status !== "completed" || !job.videoUrl) {
    throw new Error(job.error?.message || "Video is not ready to download");
  }
  return retryWithBackoff(async () => {
    const response = await fetchImpl(job.videoUrl as string, { method: "GET" });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new RetryableHttpError(
        response.status,
        message,
        response.headers.get("retry-after") ?? undefined,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  });
}

export function xaiVideoProvider(
  fetchImpl: typeof fetch = fetch,
): VideoProvider {
  return {
    id: "xai",
    create: (args, env = process.env) => createXaiVideo(args, env, fetchImpl),
    retrieve: (jobId, env = process.env) =>
      retrieveXaiVideo(jobId, env, fetchImpl),
    download: (jobId, env = process.env) =>
      downloadXaiVideo(jobId, env, fetchImpl),
  };
}

export function openaiVideoProvider(): VideoProvider {
  const fail = async (): Promise<never> => {
    throw new Error(OPENAI_VIDEOS_SHUTDOWN_MESSAGE);
  };
  return {
    id: "openai",
    create: fail,
    retrieve: fail,
    download: fail,
  };
}

export function getVideoProvider(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): VideoProvider {
  if (videoProviderId(env) === "openai") return openaiVideoProvider();
  return xaiVideoProvider(fetchImpl);
}
