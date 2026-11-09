import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { vercelTrack, insert } = vi.hoisted(() => ({
  vercelTrack: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
}));

vi.mock("@vercel/analytics", () => ({
  track: (...args: unknown[]) => vercelTrack(...args),
}));

vi.mock("./supabase", () => ({
  getBrowserSupabase: () => ({
    from: () => ({ insert }),
  }),
}));

import {
  ATTRIBUTION_STORAGE_KEY,
  captureFirstTouchAttribution,
  completeSignup,
  getAnonymousId,
  getSessionId,
  readStoredAttribution,
  resetAnalyticsSessionForTests,
  trackAsync,
} from "./analytics";

describe("first-touch attribution and track()", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vercelTrack.mockClear();
    insert.mockClear();
    resetAnalyticsSessionForTests();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores UTMs, referrer and landing path only on the first visit", () => {
    const first = captureFirstTouchAttribution(
      {
        pathname: "/demo",
        search: "?utm_source=twitter&utm_medium=social&utm_campaign=launch",
      },
      "https://t.co/abc",
    );
    expect(first).toMatchObject({
      utm_source: "twitter",
      utm_medium: "social",
      utm_campaign: "launch",
      signup_referrer: "https://t.co/abc",
      landing_path: "/demo?utm_source=twitter&utm_medium=social&utm_campaign=launch",
    });
    const second = captureFirstTouchAttribution(
      { pathname: "/pricing", search: "?utm_source=later" },
      "https://other.example",
    );
    expect(second?.utm_source).toBe("twitter");
    expect(readStoredAttribution()?.landing_path).toContain("/demo");
    expect(localStorage.getItem(ATTRIBUTION_STORAGE_KEY)).toBeTruthy();
  });

  it("reuses anonymous and session ids", () => {
    const a = getAnonymousId();
    const b = getAnonymousId();
    expect(a).toBe(b);
    const s1 = getSessionId();
    const s2 = getSessionId();
    expect(s1).toBe(s2);
    expect(a).not.toBe(s1);
  });

  it("sends a Vercel custom event and inserts into analytics_events", async () => {
    await trackAsync("heart", { demo: true, reelId: "demo-0" });
    expect(vercelTrack).toHaveBeenCalledWith(
      "heart",
      expect.objectContaining({ demo: true, reelId: "demo-0" }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "heart",
        properties: expect.objectContaining({ demo: true, reelId: "demo-0" }),
      }),
    );
    expect(vercelTrack).toHaveBeenCalledWith("session_start", expect.any(Object));
  });

  it("persists attribution and fires signup only for a new user", async () => {
    captureFirstTouchAttribution(
      { pathname: "/signin", search: "?utm_source=reddit" },
      "",
    );
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const upsert = vi.fn(async () => ({ error: null }));
    const update = vi.fn(async () => ({ error: null }));
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle }) }),
        upsert,
        update: () => ({ eq: update }),
      }),
    };
    const result = await completeSignup({
      client,
      user: { id: "user-1", email: "a@b.com", user_metadata: { name: "A" } },
    });
    expect(result.isNew).toBe(true);
    expect(upsert).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      "id",
      "user-1",
    );
    expect(vercelTrack).toHaveBeenCalledWith(
      "signup",
      expect.objectContaining({ utm_source: "reddit" }),
    );
  });
});
