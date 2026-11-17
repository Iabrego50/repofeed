import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installChunkLoadErrorHandlers,
  isChunkLoadError,
  reloadForChunkError,
} from "./chunk-load-error";

describe("isChunkLoadError", () => {
  it("matches known dynamic-import / MIME failure messages", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(
      isChunkLoadError(new Error("Failed to execute 'importScripts': 'text/html' is not a valid JavaScript MIME type.")),
    ).toBe(true);
    expect(isChunkLoadError("'text/html' is not a valid JavaScript MIME type")).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isChunkLoadError(new Error("useAuth must be used within an AuthProvider"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("reloadForChunkError", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("reloads once, then blocks another reload within the cooldown", () => {
    expect(reloadForChunkError()).toBe(true);
    expect(window.location.reload).toHaveBeenCalledTimes(1);

    expect(reloadForChunkError()).toBe(false);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("allows another reload after the cooldown", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    expect(reloadForChunkError()).toBe(true);

    now.mockReturnValue(1_000_000 + 30_001);
    expect(reloadForChunkError()).toBe(true);
    expect(window.location.reload).toHaveBeenCalledTimes(2);
  });
});

describe("installChunkLoadErrorHandlers", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("reloads on vite:preloadError and matching unhandled rejections", () => {
    installChunkLoadErrorHandlers();

    const preload = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(preload);
    expect(window.location.reload).toHaveBeenCalledTimes(1);

    sessionStorage.clear();
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: new Error("Failed to fetch dynamically imported module"),
      }),
    );
    expect(window.location.reload).toHaveBeenCalledTimes(2);
  });
});
