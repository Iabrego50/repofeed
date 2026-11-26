import { FEED_PATH, LANDING_PATH, ROOT_PATH } from "@/app-paths.ts";

/**
 * The in-app path `signin()` stored in the OIDC state, when it is safe to
 * follow: a same-origin path, and not this callback page itself.
 *
 * Missing, `/`, or `/landing` returnTo sends people into the app at `/feed`.
 */
export function resolveReturnTo(state: unknown): string {
  if (typeof state !== "object" || state === null || !("returnTo" in state)) {
    return FEED_PATH;
  }
  const { returnTo } = state;
  if (typeof returnTo !== "string" || !returnTo.startsWith("/")) return FEED_PATH;
  if (returnTo.startsWith("//") || returnTo.startsWith("/\\")) return FEED_PATH;
  if (returnTo.startsWith("/auth/callback")) return FEED_PATH;
  if (returnTo === ROOT_PATH || returnTo === LANDING_PATH) return FEED_PATH;
  return returnTo;
}
