import { describe, expect, it } from "vitest";
import {
  buildAdminAnalytics,
  isInternalAccount,
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
      events: [
        {
          event: "first_upload",
          created_at: "2026-11-08T01:00:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/studies/new",
          properties: {},
        },
        {
          event: "generate_started",
          created_at: "2026-11-08T02:00:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/studies/x",
          properties: {},
        },
        {
          event: "feed_open",
          created_at: "2026-11-08T03:00:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-k",
          session_id: "s1",
          path: "/",
          properties: {},
        },
        {
          event: "session_start",
          created_at: "2026-11-08T00:00:00.000Z",
          user_id: null,
          anonymous_id: "anon-demo",
          session_id: "demo-1",
          path: "/demo",
          properties: { demo: true },
        },
        {
          event: "heart",
          created_at: "2026-11-08T00:01:00.000Z",
          user_id: null,
          anonymous_id: "anon-demo",
          session_id: "demo-1",
          path: "/demo",
          properties: { demo: true },
        },
        {
          event: "signup",
          created_at: "2026-11-08T00:02:00.000Z",
          user_id: "kate",
          anonymous_id: "anon-demo",
          session_id: "s1",
          path: "/signin",
          properties: {},
        },
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

    const included = buildAdminAnalytics(
      tables,
      { range: "30d", excludeInternal: false },
      NOW,
    );
    expect(included.headlines.users).toBe(3);
  });
});
