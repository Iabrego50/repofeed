import { isNativePlatform } from "@/lib/native";

/**
 * Viewer-only shell on Capacitor: hide creator/billing chrome.
 * Admins (`users.is_admin` from the server) keep full native access.
 * Never treat a client-only flag as authoritative for admin APIs —
 * those routes already 404 unless `is_admin` is true in the DB.
 */
export function isNativeViewerMode(isAdmin: boolean | null | undefined): boolean {
  return isNativePlatform() && isAdmin !== true;
}

/** Creator chrome on native when the signed-in user is an admin. */
export function isNativeAdminAccess(isAdmin: boolean | null | undefined): boolean {
  return isNativePlatform() && isAdmin === true;
}
