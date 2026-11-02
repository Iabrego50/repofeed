import { afterEach, describe, expect, it, vi } from "vitest";
import {
  continuationAccepted,
  dispatchGenerationProcess,
  generationProcessHeaders,
  generationProcessUrl,
  siteBaseUrl,
} from "../../../api/_lib/generation-chain";
import { GENERATION_INTERNAL_SECRET_HEADER } from "../../../api/_lib/auth";
import { canRunAnotherStep } from "./generation-guards";

const KEYS = [
  "SITE_URL",
  "VITE_SITE_URL",
  "VERCEL_URL",
  "GENERATION_INTERNAL_SECRET",
  "VERCEL_AUTOMATION_BYPASS_SECRET",
] as const;

function snapshotEnv() {
  return Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe("generation process chaining URLs", () => {
  const original = snapshotEnv();

  afterEach(() => {
    restoreEnv(original);
  });

  it("prefers SITE_URL over VITE_SITE_URL and VERCEL_URL", () => {
    const env = {
      SITE_URL: "https://repofeed.ai/",
      VITE_SITE_URL: "https://unused.example",
      VERCEL_URL: "preview.vercel.app",
    };
    expect(siteBaseUrl(env)).toBe("https://repofeed.ai");
    expect(generationProcessUrl(env)).toBe("https://repofeed.ai/api/generation/process");
  });

  it("falls back to VITE_SITE_URL then https://VERCEL_URL", () => {
    expect(siteBaseUrl({ VITE_SITE_URL: "https://app.example.com" })).toBe("https://app.example.com");
    expect(siteBaseUrl({ VERCEL_URL: "my-app-123.vercel.app" })).toBe(
      "https://my-app-123.vercel.app",
    );
    expect(siteBaseUrl({ VERCEL_URL: "https://already-https.vercel.app/" })).toBe(
      "https://already-https.vercel.app",
    );
  });

  it("sends the internal secret and Vercel protection bypass headers", () => {
    const headers = generationProcessHeaders({
      GENERATION_INTERNAL_SECRET: "gen-secret",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
    });
    expect(headers[GENERATION_INTERNAL_SECRET_HEADER]).toBe("gen-secret");
    expect(headers["x-vercel-protection-bypass"]).toBe("bypass-secret");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("treats 202 as continuation acceptance", () => {
    expect(continuationAccepted({ status: 202 })).toEqual({ accepted: true, status: 202 });
    expect(continuationAccepted({ status: 500 })).toEqual({ accepted: false, status: 500 });
    expect(continuationAccepted({ ok: true })).toEqual({ accepted: true, status: 202 });
  });

  it("awaits 202 acceptance and retries after a failed dispatch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ status: 500, ok: false })
      .mockResolvedValueOnce({ status: 202, ok: true });
    const result = await dispatchGenerationProcess(
      "job-1",
      { SITE_URL: "https://example.com", GENERATION_INTERNAL_SECRET: "s" },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, status: 202 });
  });

  it("does not wait for the downstream step to finish past 202", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const pending = dispatchGenerationProcess(
      "job-1",
      { SITE_URL: "https://example.com" },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch?.({ status: 202, ok: true });
    await expect(pending).resolves.toEqual({ ok: true, status: 202 });
  });
});

describe("inline step budget", () => {
  it("runs the next step in the same invocation when there is time left", () => {
    const startedAt = 1_000_000;
    expect(canRunAnotherStep({ startedAt, now: startedAt + 58 })).toBe(true);
    expect(canRunAnotherStep({ startedAt, now: startedAt + 250_000 })).toBe(false);
  });
});
