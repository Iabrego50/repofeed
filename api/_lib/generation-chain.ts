import { GENERATION_INTERNAL_SECRET_HEADER } from "./auth.js";

export function siteBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = String(env.SITE_URL || env.VITE_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (explicit) return explicit;

  const vercelHost = String(env.VERCEL_URL || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (vercelHost) return `https://${vercelHost}`;
  return "";
}

export function generationProcessUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base = siteBaseUrl(env);
  if (!base) {
    throw new Error("SITE_URL, VITE_SITE_URL, or VERCEL_URL is required to chain generation steps");
  }
  return `${base}/api/generation/process`;
}

export function generationProcessHeaders(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = String(env.GENERATION_INTERNAL_SECRET || "").trim();
  if (secret) {
    headers[GENERATION_INTERNAL_SECRET_HEADER] = secret;
  }
  const bypass = String(env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
  }
  return headers;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<unknown>;

function defaultFetch(): FetchLike {
  return globalThis.fetch as FetchLike;
}

/** Kick the next process invocation. Does not wait for that invocation to finish. */
export function fetchGenerationProcess(
  jobId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = defaultFetch(),
): Promise<unknown> {
  const url = generationProcessUrl(env);
  return fetchImpl(url, {
    method: "POST",
    headers: generationProcessHeaders(env),
    body: JSON.stringify({ jobId }),
  });
}

async function scheduleWaitUntil(work: Promise<unknown>): Promise<boolean> {
  try {
    const { waitUntil } = await import("@vercel/functions");
    if (typeof waitUntil !== "function") return false;
    waitUntil(work);
    return true;
  } catch {
    return false;
  }
}

/**
 * Continue generation in a *new* invocation. Never await the downstream
 * function — that nested the whole pipeline into one 300s Vercel timeout.
 */
export async function enqueueGenerationProcess(
  jobId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = defaultFetch(),
): Promise<void> {
  const work = fetchGenerationProcess(jobId, env, fetchImpl).catch((error) => {
    console.error("Generation process continuation failed:", error);
  });
  await scheduleWaitUntil(work);
}
