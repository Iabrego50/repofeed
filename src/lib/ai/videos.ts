import { RetryableHttpError, retryWithBackoff } from "../api/async-jobs.js";
import { ServerNotConfiguredError } from "../server-env.js";
import {
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_SECONDS,
  DEFAULT_VIDEO_SIZE,
} from "../api/reel-video.js";

export type OpenAIVideoStatus =
  "queued" | "in_progress" | "completed" | "failed";

export type OpenAIVideoJob = {
  id: string;
  status: OpenAIVideoStatus;
  progress?: number;
  model?: string;
  error?: { message?: string; code?: string } | null;
};

export type CreateVideoArgs = {
  prompt: string;
  model?: string;
  seconds?: string;
  size?: string;
  imageUrl?: string;
};

const DEFAULT_BASE = "https://api.openai.com/v1";

export function openaiVideoBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = String(
    env.OPENAI_VIDEO_BASE_URL || env.OPENAI_BASE_URL || "",
  )
    .trim()
    .replace(/\/$/, "");
  return override || DEFAULT_BASE;
}

function apiKey(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.OPENAI_API_KEY ?? "").trim();
  if (!value) throw new ServerNotConfiguredError("OPENAI_API_KEY");
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

async function videoFetch(
  path: string,
  init: RequestInit,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const response = await fetchImpl(`${openaiVideoBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey(env)}`,
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

function parseJob(payload: unknown): OpenAIVideoJob {
  if (!payload || typeof payload !== "object")
    throw new Error("Video API returned no job");
  const row = payload as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) throw new Error("Video API returned no job id");
  const status = String(row.status || "queued") as OpenAIVideoStatus;
  const error =
    row.error && typeof row.error === "object"
      ? {
          message: String(
            (row.error as { message?: unknown }).message ??
              "Video generation failed",
          ),
          code: (row.error as { code?: unknown }).code
            ? String((row.error as { code?: unknown }).code)
            : undefined,
        }
      : null;
  return {
    id,
    status,
    progress: typeof row.progress === "number" ? row.progress : undefined,
    model: typeof row.model === "string" ? row.model : undefined,
    error,
  };
}

export async function createOpenAIVideo(
  args: CreateVideoArgs,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenAIVideoJob> {
  const body: Record<string, unknown> = {
    prompt: args.prompt,
    model: args.model || DEFAULT_VIDEO_MODEL,
    seconds: args.seconds || DEFAULT_VIDEO_SECONDS,
    size: args.size || DEFAULT_VIDEO_SIZE,
  };
  if (args.imageUrl) {
    body.input_reference = { image_url: args.imageUrl };
  }

  return retryWithBackoff(async () => {
    const response = await videoFetch(
      "/videos",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      env,
      fetchImpl,
    );
    return parseJob(await response.json());
  });
}

export async function retrieveOpenAIVideo(
  videoId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenAIVideoJob> {
  return retryWithBackoff(async () => {
    const response = await videoFetch(
      `/videos/${encodeURIComponent(videoId)}`,
      { method: "GET" },
      env,
      fetchImpl,
    );
    return parseJob(await response.json());
  });
}

export async function downloadOpenAIVideo(
  videoId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  return retryWithBackoff(async () => {
    const response = await videoFetch(
      `/videos/${encodeURIComponent(videoId)}/content`,
      { method: "GET" },
      env,
      fetchImpl,
    );
    return new Uint8Array(await response.arrayBuffer());
  });
}

export type OpenAIVideoClient = {
  create: typeof createOpenAIVideo;
  retrieve: typeof retrieveOpenAIVideo;
  download: typeof downloadOpenAIVideo;
};

export function defaultOpenAIVideoClient(): OpenAIVideoClient {
  return {
    create: createOpenAIVideo,
    retrieve: retrieveOpenAIVideo,
    download: downloadOpenAIVideo,
  };
}
