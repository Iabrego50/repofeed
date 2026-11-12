import { describe, expect, it } from "vitest";
import { FEED_PATH } from "@/app-paths.ts";
import { resolveReturnTo } from "./return-to.ts";

describe("resolveReturnTo", () => {
  it("defaults to the in-app feed when there is no returnTo", () => {
    expect(resolveReturnTo(null)).toBe(FEED_PATH);
    expect(resolveReturnTo(undefined)).toBe(FEED_PATH);
    expect(resolveReturnTo({})).toBe(FEED_PATH);
    expect(resolveReturnTo({ returnTo: null })).toBe(FEED_PATH);
  });

  it("does not send people back to the marketing landing after sign-in", () => {
    expect(resolveReturnTo({ returnTo: "/" })).toBe(FEED_PATH);
  });

  it("rejects open redirects and the callback itself", () => {
    expect(resolveReturnTo({ returnTo: "//evil.example" })).toBe(FEED_PATH);
    expect(resolveReturnTo({ returnTo: "/\\evil.example" })).toBe(FEED_PATH);
    expect(resolveReturnTo({ returnTo: "https://evil.example" })).toBe(FEED_PATH);
    expect(resolveReturnTo({ returnTo: "/auth/callback" })).toBe(FEED_PATH);
    expect(resolveReturnTo({ returnTo: "/auth/callback?code=1" })).toBe(FEED_PATH);
  });

  it("keeps a safe same-origin in-app path", () => {
    expect(resolveReturnTo({ returnTo: "/studies" })).toBe("/studies");
    expect(resolveReturnTo({ returnTo: "/feed?reel=abc" })).toBe("/feed?reel=abc");
  });
});
