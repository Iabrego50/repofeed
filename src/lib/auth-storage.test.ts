import { beforeEach, describe, expect, it, vi } from "vitest";

const bag = vi.hoisted(() => ({
  native: false,
  prefs: new Map<string, string>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => bag.native,
  },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: bag.prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      bag.prefs.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      bag.prefs.delete(key);
    },
  },
}));

import {
  authStorageKeyFromUrl,
  createAuthStorage,
  migrateNativeAuthStorage,
} from "./auth-storage";

describe("auth storage", () => {
  beforeEach(() => {
    bag.native = false;
    bag.prefs.clear();
    localStorage.clear();
  });

  it("builds the default supabase storage key from the project URL", () => {
    expect(authStorageKeyFromUrl("https://odvpqotwaokflegpmmej.supabase.co")).toBe(
      "sb-odvpqotwaokflegpmmej-auth-token",
    );
  });

  it("uses localStorage on web", async () => {
    const storage = createAuthStorage();
    await storage.setItem("k", "v");
    expect(localStorage.getItem("k")).toBe("v");
    expect(await storage.getItem("k")).toBe("v");
  });

  it("migrates a legacy WebView session into Preferences on native", async () => {
    bag.native = true;
    const key = "sb-demo-auth-token";
    localStorage.setItem(key, '{"access_token":"x"}');
    await migrateNativeAuthStorage(key);
    expect(bag.prefs.get(key)).toBe('{"access_token":"x"}');
    // Second call does not overwrite Preferences.
    localStorage.setItem(key, '{"access_token":"y"}');
    await migrateNativeAuthStorage(key);
    expect(bag.prefs.get(key)).toBe('{"access_token":"x"}');
  });
});
