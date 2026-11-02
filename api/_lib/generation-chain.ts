import { waitUntil } from "@vercel/functions";
import { DISPATCH_RETRY_ATTEMPTS } from "../../src/lib/api/generation-guards.js";
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
export type WaitUntilFn = (work: Promise<unknown>) => void;

function defaultFetch(): FetchLike {
  return globalThis.fetch as FetchLike;
}

export function defaultWaitUntil(): WaitUntilFn {
  return (work) => {
    try {
      waitUntil(work);
    } catch (error) {
      console.error("waitUntil failed; continuation already started:", error);
    }
  };
}

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

export function continuationAccepted(res: unknown): { accepted: boolean; status: number } {
  if (!res || typeof res !== "object") return { accepted: false, status: 0 };
  const statusRaw = (res as { status?: unknown }).status;
  const status = typeof statusRaw === "number" ? statusRaw : 0;
  const ok = (res as { ok?: unknown }).ok === true;
  const accepted = status === 202 || (status >= 200 && status < 300) || (ok && status === 0);
  return { accepted, status: status || (accepted ? 202 : 0) };
}

/**
 * POST /process and wait until that invocation has *accepted* (202), not until
 * it finishes extract/compose. Retry on network/5xx. Log dispatch and acceptance.
 */
export async function dispatchGenerationProcess(
  jobId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = defaultFetch(),
  attempts = DISPATCH_RETRY_ATTEMPTS,
): Promise<{ ok: true; status: number }> {
  const url = generationProcessUrl(env);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.info(`[generation] dispatch start job=${jobId} attempt=${attempt}/${attempts} url=${url}`);
    try {
      const res = await fetchGenerationProcess(jobId, env, fetchImpl);
      const { accepted, status } = continuationAccepted(res);
      if (accepted) {
        console.info(`[generation] dispatch accepted job=${jobId} attempt=${attempt} status=${status}`);
        return { ok: true, status };
      }
      lastError = new Error(`Continuation HTTP ${status || "unknown"}`);
      console.warn(`[generation] dispatch rejected job=${jobId} attempt=${attempt} status=${status}`);
    } catch (error) {
      lastError = error;
      console.warn(`[generation] dispatch error job=${jobId} attempt=${attempt}`, error);
    }
  }
  console.error(`[generation] dispatch failed job=${jobId} after ${attempts} attempts`, lastError);
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** @deprecated Use dispatchGenerationProcess — kept so older tests can spy the name. */
export async function enqueueGenerationProcess(
  jobId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = defaultFetch(),
  _waitUntilFn?: WaitUntilFn,
): Promise<{ ok: true; status: number }> {
  return dispatchGenerationProcess(jobId, env, fetchImpl);
}
