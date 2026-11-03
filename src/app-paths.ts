/** Canonical in-app paths the router must handle. Tests crawl this table. */

export const PUBLIC_APP_PATHS = [
  "/",
  "/demo",
  "/demo/insights",
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
  "/insights",
  "/insights/deck",
  "/settings",
  "/billing",
] as const;

export const APP_PATHS = [...PUBLIC_APP_PATHS, ...PROTECTED_APP_PATHS] as const;

export function signInPath(returnTo?: string): string {
  if (!returnTo || returnTo === "/" || returnTo.startsWith("/signin")) return "/signin";
  return `/signin?returnTo=${encodeURIComponent(returnTo)}`;
}
