import { EXPLORE_PATH, FEED_PATH } from "@/app-paths.ts";
import { isNativePlatform } from "@/lib/native";

/**
 * Non-admin on Capacitor: join-code onboarding, no desktop team settings.
 * Explore-only chrome applies to everyone on native (including admins).
 */
export function isNativeViewerMode(isAdmin: boolean | null | undefined): boolean {
  return isNativePlatform() && isAdmin !== true;
}

/**
 * Product admin on native. Extra: Analytics link in the profile menu only —
 * no Insights, deck, or creator chrome. Server still gates `/api/admin/*`.
 */
export function isNativeAdminAccess(isAdmin: boolean | null | undefined): boolean {
  return isNativePlatform() && isAdmin === true;
}

/** Home path after sign-in: Explore on native, Feed on web. */
export function appHomePath(): string {
  return isNativePlatform() ? EXPLORE_PATH : FEED_PATH;
}
