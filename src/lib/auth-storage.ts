import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/**
 * Supabase auth storage.
 *
 * Web: `localStorage` (same-origin, survives reloads and return visits).
 * Native Capacitor: `@capacitor/preferences` (UserDefaults / SharedPreferences).
 * WKWebView may reclaim `localStorage` under storage pressure or after updates,
 * which would force another email sign-in code on every launch.
 */
const nativeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
};

/** One-time copy of any session left in WebView localStorage into Preferences. */
export async function migrateNativeAuthStorage(storageKey: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const existing = await Preferences.get({ key: storageKey });
    if (existing.value) return;
    const legacy = globalThis.localStorage?.getItem(storageKey);
    if (!legacy) return;
    await Preferences.set({ key: storageKey, value: legacy });
  } catch {
    // Migration is best-effort; sign-in still works without it.
  }
}

export function createAuthStorage(): typeof nativeAuthStorage | Storage {
  if (Capacitor.isNativePlatform()) return nativeAuthStorage;
  return globalThis.localStorage;
}

/** Supabase default key: `sb-<project-ref>-auth-token`. */
export function authStorageKeyFromUrl(supabaseUrl: string): string {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split(".")[0] || "repofeed";
    return `sb-${ref}-auth-token`;
  } catch {
    return "sb-repofeed-auth-token";
  }
}
