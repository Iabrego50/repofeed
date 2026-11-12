import { describe, expect, it } from "vitest";
import {
  buildAdminAnalytics,
  buildProductDaily,
  buildProductFunnel,
  countUniqueSessions,
  isInternalAccount,
  namedCounts,
  parseAdminAnalyticsQuery,
  type AdminAnalyticsTables,
} from "./admin-analytics";

const NOW = new Date("2026-11-09T12:00:00.000Z");

function emptyTables(): AdminAnalyticsTables {
  return {
    users: [],
    workspaces: [],
    members: [],
    studies: [],
    reels: [],
    jobs: [],
    events: [],
    counters: [],
    reactions: [],
    comments: [],
    saved: [],
  };
}

function event(
  name: string,
  extra: Partial<AdminAnalyticsTables["events"][number]> = {},
): AdminAnalyticsTables["events"][number] {
  return {
    event: name,
    created_at: "2026-11-08T00:00:00.000Z",
    user_id: null,
    anonymous_id: "anon",
    session_id: "s",
    path: "/",
    properties: {},
    ...extra,
  };
}

describe("admin analytics helpers", () => {
  it("defaults to 30d and excluding internal accounts", () => {
    expect(parseAdminAnalyticsQuery({})).toEqual({ range: "30d", excludeInternal: true });
    expect(parseAdminAnalyticsQuery({ range: "7d", excludeInternal: "0" })).toEqual({
      range: "7d",
      excludeInternal: false,
    });
  });

  it("treats admins and grokbot emails as internal", () => {
    expect(isInternalAccount({ is_admin: true, email: "a@b.com" })).toBe(true);
    expect(isInternalAccount({ is_admin: false, email: "bot@mail.grokbot.com" })).toBe(true);
    expect(isInternalAccount({ is_admin: false, email: "kate@example.com" })).toBe(false);
  });

  it("ranks named counts by frequency, then name", () => {
    expect(namedCounts(["twitter", "google", "twitter", "direct", "google", "twitter"])).toEqual([
      { name: "twitter", count: 3 },
      { name: "google", count: 2 },
      { name: "direct", count: 1 },
    ]);
  });

  it("counts unique sessions, including unsigned ones", () => {
    const start = new Date("2026-11-01T00:00:00.000Z");
    expect(
      countUniqueSessions(
        [
          event("session_start", { session_id: "a", user_id: null }),
          event("session_start", { session_id: "a", user_id: "kate" }),
          event("session_start", { session_id: "b", user_id: null, path: "/for/research-repository" }),
          event("landing_view", { session_id: "c" }),
        ],
        start,
        NOW,
      ),
    ).toBe(2);
  });

  it("fills empty days in a ranged product trend and ranks activity onto the right day", () => {
    const daily = buildProductDaily({
      users: [{ created_at: "2026-11-08T10:00:00.000Z" }],
      studies: [{ created_at: "2026-11-08T11:00:00.000Z" }, { created_at: "2026-11-08T12:00:00.000Z" }],
      reels: [{ created_at: "2026-11-07T09:00:00.000Z" }],
      events: [
        event("scene_view", { created_at: "2026-11-08T13:00:00.000Z" }),
        event("scene_view", { created_at: "2026-11-08T14:00:00.000Z" }),
        event("scene_view", { created_at: "2026-11-08T15:00:00.000Z" }),
      ],
      start: new Date("2026-11-07T12:00:00.000Z"),
      now: NOW,
    });
    expect(daily[0]).toEqual({ day: "2026-11-07", signups: 0, studies: 0, reels: 1, views: 0 });
    expect(daily.at(-1)).toEqual({ day: "2026-11-09", signups: 0, studies: 0, reels: 0, views: 0 });
    expect(daily.find((row) => row.day === "2026-11-08")).toEqual({
      day: "2026-11-08",
      signups: 1,
      studies: 2,
      reels: 0,
      views: 3,
    });
  });

  it("builds a visit-to-first-scene funnel", () => {
    expect(
      buildProductFunnel({
        visits: 10,
        cohort: [{ id: "a" }, { id: "b" }, { id: "c" }],
        userHasEvent: (id, name) => {
          const names = new Set(Array.isArray(name) ? name : [name]);
          if (id === "a") return names.has("first_upload") || names.has("generate_completed");
          if (id === "b") return names.has("generate_started");
          return false;
        },
      }),
    ).toEqual([
      { key: "visit", label: "Visited", count: 10 },
      { key: "signup", label: "Signed up", count: 3 },
      { key: "first_study", label: "Started a study", count: 2 },
      { key: "first_reel", label: "Generated a scene", count: 1 },
    ]);
  });

  it("builds a signup-to-paid funnel and drops internal users when asked", () => {
    const tables: AdminAnalyticsTables = {
      ...emptyTables(),
      users: [
        {
          id: "isaac",
          email: "owner@example.com",
          created_at: "2026-11-01T00:00:00.000Z",
          is_admin: true,
          utm_source: "direct",
          signup_referrer: null,
          landing_path: "/",
        },
        {
          id: "kate",
          email: "kate@example.com",
          created_at: "2026-11-08T00:00:00.000Z",
          is_admin: false,
          utm_source: "twitter",
          signup_referrer: "https://t.co/x",
          landing_path: "/demo",
        },
        {
          id: "bot",
          email: "ci@mail.grokbot.com",
          created_at: "2026-11-08T00:00:00.000Z",
          is_admin: false,
          utm_source: "ci",
          signup_referrer: null,
          landing_path: "/",
        },
      ],
      workspaces: [
        {
          id: "ws-demo",
          name: "Demo",
          created_by: "isaac",
          created_at: "2026-11-01T00:00:00.000Z",
          paid_plan: "pro",
          customer_id: "cus_1",
        },
      ],
      members: [
        { workspace_id: "ws-demo", user_id: "isaac" },
        { workspace_id: "ws-demo", user_id: "kate" },
      ],
      studies: [{ id: "st-1", workspace_id: "ws-demo", created_at: "2026-11-08T01:30:00.000Z" }],
      reels: [
        {
          id: "r-1",
          study_id: "st-1",
          workspace_id: "ws-demo",
          created_at: "2026-11-08T02:30:00.000Z",
          footage: null,
          video: null,
        },
      ],
      events: [
        event("session_start", {
          created_at: "2026-11-08T00:00:00.000Z",
          user_id: null,
          anonymous_id: "anon-landing",
          session_id: "land-1",
          path: "/",
          properties: {},
        }),
        event("scene_view", {
          created_at: "2026-11-08T00:05:00.000Z",
          user_id: null,
          anonymous_id: "anon-landing",
          session_id: "land-1",
          path: "/demo",
          properties: {},
        }),
        event("first_upload", {
          created_at: "2026-11-08T01:00:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/studies/new",
        }),
        event("generate_started", {
          created_at: "2026-11-08T02:00:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/studies/x",
        }),
        event("generate_completed", {
          created_at: "2026-11-08T02:20:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/studies/x",
        }),
        event("feed_open", {
          created_at: "2026-11-08T03:00:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/",
        }),
        event("session_start", {
          created_at: "2026-11-08T00:00:00.000Z",
          user_id: null,
          anonymous_id: "anon-demo",
          session_id: "demo-1",
          path: "/demo",
          properties: { demo: true },
        }),
        event("heart", {
          created_at: "2026-11-08T00:01:00.000Z",
          user_id: null,
          anonymous_id: "anon-demo",
          session_id: "demo-1",
          path: "/demo",
          properties: { demo: true },
        }),
        event("signup", {
          created_at: "2026-11-08T00:02:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-demo",
          session_id: "s1",
          path: "/signin",
        }),
      ],
      counters: [{ views: 12, viewers: 4 }],
    };

    const excluded = buildAdminAnalytics(
      tables,
      { range: "30d", excludeInternal: true },
      NOW,
    );
    expect(excluded.headlines.users).toBe(1);
    expect(excluded.funnel[0]).toEqual({ key: "signup", label: "Signed up", count: 1 });
    expect(excluded.funnel.find((step) => step.key === "first_upload")?.count).toBe(1);
    expect(excluded.funnel.find((step) => step.key === "paid")?.count).toBe(1);
    expect(excluded.signups.bySource[0]).toEqual({ name: "twitter", count: 1 });
    expect(excluded.demo).toEqual({ sessions: 1, interacted: 1, signedUp: 1 });
    expect(excluded.engagement.views).toBe(12);
    expect(excluded.plans.paidWorkspaces).toBe(1);
    expect(excluded.product.visits).toBe(2);
    expect(excluded.product.viewsInRange).toBe(1);
    expect(excluded.product.funnel).toEqual([
      { key: "visit", label: "Visited", count: 2 },
      { key: "signup", label: "Signed up", count: 1 },
      { key: "first_study", label: "Started a study", count: 1 },
      { key: "first_reel", label: "Generated a scene", count: 1 },
    ]);
    expect(excluded.headlines.studies).toBe(1);
    expect(excluded.headlines.reels).toBe(1);

    const included = buildAdminAnalytics(
      tables,
      { range: "30d", excludeInternal: false },
      NOW,
    );
    expect(included.headlines.users).toBe(3);
  });
});
