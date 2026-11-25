import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/native", () => ({
  isNativePlatform: vi.fn(() => false),
}));

import { isNativePlatform } from "@/lib/native";
import { appHomePath, isNativeAdminAccess, isNativeViewerMode } from "./native-access";

describe("native-access", () => {
  afterEach(() => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
  });

  it("never applies viewer-only on web", () => {
    expect(isNativeViewerMode(false)).toBe(false);
    expect(isNativeViewerMode(true)).toBe(false);
    expect(isNativeAdminAccess(true)).toBe(false);
    expect(appHomePath()).toBe("/feed");
  });

  it("applies viewer-only on native for non-admins only", () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    expect(isNativeViewerMode(false)).toBe(true);
    expect(isNativeViewerMode(undefined)).toBe(true);
    expect(isNativeViewerMode(true)).toBe(false);
    expect(isNativeAdminAccess(true)).toBe(true);
    expect(isNativeAdminAccess(false)).toBe(false);
    expect(appHomePath()).toBe("/home");
  });
});
