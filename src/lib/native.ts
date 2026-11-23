import { Capacitor } from "@capacitor/core";

/** Custom URL scheme registered in ios/App Info.plist (CFBundleURLSchemes). */
export const NATIVE_URL_SCHEME = "ai.repofeed.app";

/** True when running inside a Capacitor native shell (iOS/Android). */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNativeIos(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/**
 * Origin used for Supabase OAuth / magic-link redirectTo.
 * On native, deep links use the custom scheme so the OS returns to the app.
 */
export function authRedirectOrigin(): string {
  if (isNativePlatform()) {
    return `${NATIVE_URL_SCHEME}://`;
  }
  return window.location.origin;
}

/**
 * Convert an appUrlOpen URL (custom scheme or https universal link) into a
 * path the SPA router understands, e.g. `/auth/callback?code=…`.
 */
export function pathFromAppUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    // ai.repofeed.app://auth/callback?code=… → host=auth, pathname=/callback
    const host = parsed.hostname;
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    if (!host && !path) return null;
    const combined = host ? `/${host}${path}` : path;
    return `${combined}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
