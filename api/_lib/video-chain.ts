import { generationProcessHeaders, siteBaseUrl } from "./generation-chain.js";

export function videoProcessUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base = siteBaseUrl(env);
  if (!base) {
    throw new Error(
      "SITE_URL, VITE_SITE_URL, or VERCEL_URL is required to process reel videos",
    );
  }
  return `${base}/api/videos/process`;
}

export async function dispatchVideoProcess(
  args: { studyId?: string } = {},
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = videoProcessUrl(env);
  const res = await fetchImpl(url, {
    method: "POST",
    headers: generationProcessHeaders(env),
    body: JSON.stringify({ studyId: args.studyId }),
  });
  if (
    !res ||
    (typeof res === "object" &&
      "ok" in res &&
      res.ok === false &&
      Number(res.status) >= 500)
  ) {
    throw new Error(
      `Video process HTTP ${res && "status" in res ? res.status : "unknown"}`,
    );
  }
}
