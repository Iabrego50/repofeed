/** Canonical in-app paths the router must handle. Tests crawl this table. */

/** Site root — routes new visitors into the product story. */
export const ROOT_PATH = "/";

/** Marketing landing (pricing, FAQ). Reachable after the story via Learn more. */
export const LANDING_PATH = "/landing";

/** In-app feed (web). On native Capacitor the home surface is Explore. */
export const FEED_PATH = "/feed";

/** Explore home. On native this mounts the scrollable scene feed. */
export const EXPLORE_PATH = "/explore";

export const PUBLIC_APP_PATHS = [
  "/",
  "/landing",
  "/for/research-repository",
  "/demo",
  "/demo/insights",
  "/demo/explore",
  "/demo/deck",
  "/help",
  "/terms",
  "/privacy",
  "/signin",
  "/login",
  "/auth",
  "/auth/callback",
  "/auth/confirm",
  "/welcome",
  "/s/test-token",
  "/share/test-token",
  "/invite/test-token",
] as const;

export const PROTECTED_APP_PATHS = [
  "/feed",
  "/dashboard",
  "/home",
  "/d/auto",
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
  if (
    !returnTo ||
    returnTo === ROOT_PATH ||
    returnTo === LANDING_PATH ||
    returnTo === FEED_PATH ||
    returnTo.startsWith("/signin")
  ) {
    return "/signin";
  }
  return `/signin?returnTo=${encodeURIComponent(returnTo)}`;
}
