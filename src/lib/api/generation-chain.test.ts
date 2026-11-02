import { afterEach, describe, expect, it } from "vitest";
import {
  generationProcessHeaders,
  generationProcessUrl,
  siteBaseUrl,
} from "../../../api/_lib/generation-chain";
import { GENERATION_INTERNAL_SECRET_HEADER } from "../../../api/_lib/auth";

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
});
