/** Canonical in-app paths the router must handle. Tests crawl this table. */

/** Marketing site root. Always the landing page, signed-in or not. */
export const LANDING_PATH = "/";

/** In-app feed. Signed-in default after sign-in when there is no returnTo. */
export const FEED_PATH = "/feed";

export const PUBLIC_APP_PATHS = [
  "/",
  "/for/research-repository",
  "/demo",
  "/demo/insights",
  "/demo/deck",
  "/help",
  "/terms",
  "/privacy",
  "/signin",
  "/login",
  "/auth",
  "/auth/callback",
  "/auth/confirm",
  "/s/test-token",
  "/share/test-token",
  "/invite/test-token",
] as const;

export const PROTECTED_APP_PATHS = [
  "/feed",
  "/dashboard",
  "/welcome",
  "/studies",
  "/studies/new",
  "/studies/test-study-id",
  "/explore",
  "/insights",
  "/insights/deck",
  "/settings",
  "/billing",
] as const;

export const APP_PATHS = [...PUBLIC_APP_PATHS, ...PROTECTED_APP_PATHS] as const;

export function signInPath(returnTo?: string): string {
  if (!returnTo || returnTo === LANDING_PATH || returnTo === FEED_PATH || returnTo.startsWith("/signin")) {
    return "/signin";
  }
  return `/signin?returnTo=${encodeURIComponent(returnTo)}`;
}
