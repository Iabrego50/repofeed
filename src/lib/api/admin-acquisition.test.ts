import { describe, expect, it } from "vitest";
import { buildAcquisition, classifyChannel, spendInWindow, type AcqEvent, type AcqUser } from "./admin-acquisition";

const now = new Date("2026-11-09T12:00:00Z");
const start = new Date("2026-10-10T12:00:00Z");

function session(id: string, props: Record<string, string>, path = "/for/research-repository"): AcqEvent {
  return { event: "session_start", created_at: "2026-11-01T10:00:00Z", user_id: null, session_id: id, path, properties: props };
}

function user(id: string, extra: Partial<AcqUser> = {}): AcqUser {
  return { id, created_at: "2026-11-01T10:05:00Z", utm_source: null, signup_referrer: null, landing_path: "/", ...extra };
}

const google = { utm_source: "google", utm_medium: "cpc", utm_campaign: "repository-search" };

describe("classifyChannel", () => {
  it("separates paid search, paid social, organic and direct", () => {
    expect(classifyChannel({ source: "google", medium: "cpc" })).toBe("Paid search");
    expect(classifyChannel({ source: "linkedin", medium: "paid_social" })).toBe("Paid social");
    expect(classifyChannel({ source: "", medium: "", clickIdType: "gclid" })).toBe("Paid search");
    expect(classifyChannel({ source: "newsletter", medium: "email" })).toBe("Email");
    expect(classifyChannel({ referrer: "https://www.google.com/" })).toBe("Organic search");
    expect(classifyChannel({ referrer: "https://news.example.org/post" })).toBe("Referral");
    expect(classifyChannel({})).toBe("Direct");
  });
});

describe("spendInWindow", () => {
  const entry = { id: "1", period_start: "2026-10-01", period_end: "2026-10-30", source: "google", medium: "cpc", campaign: "c", amount_cents: 30_000, note: null };
  it("counts the whole amount when the period sits inside the window", () => {
    expect(spendInWindow(entry, null, now)).toBe(30_000);
  });
  it("prorates by days when the window starts part-way through", () => {
    expect(spendInWindow(entry, new Date("2026-10-16T00:00:00Z"), now)).toBe(15_000);
  });
  it("ignores spend that is entirely outside the window", () => {
    expect(spendInWindow(entry, new Date("2026-11-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("buildAcquisition", () => {
  const events: AcqEvent[] = [
    session("s1", google),
    session("s2", google),
    session("s3", google),
    session("s4", google),
    session("s1", google), // same session reported twice counts once
    session("s5", {}, "/"),
    { event: "cta_click", created_at: "2026-11-01T10:01:00Z", user_id: null, session_id: "s1", path: "/", properties: google },
    { event: "generate_started", created_at: "2026-11-02T10:00:00Z", user_id: "u1", session_id: "s1", path: "/studies/new", properties: {} },
    { event: "subscription_started", created_at: "2026-11-03T10:00:00Z", user_id: null, workspace_id: "w1", session_id: null, path: null, properties: {} },
  ];
  const users = [
    user("u1", { ...google, landing_path: "/for/research-repository?utm_source=google", click_id: "abc", click_id_type: "gclid", utm_term: "research repository" }),
    user("u2", google),
    user("u3"),
    user("old", { ...google, created_at: "2026-01-01T00:00:00Z" }),
  ];
  const result = buildAcquisition({
    users,
    events,
    workspaces: [
      { id: "w1", created_by: "u1", paid_plan: "pro" },
      { id: "w2", created_by: "u2", paid_plan: null },
    ],
    spend: [{ id: "sp", period_start: "2026-10-20", period_end: "2026-11-08", source: "Google", medium: "cpc", campaign: "Repository-Search", amount_cents: 20_000, note: null }],
    start,
    now,
  });
  const row = result.campaigns.find((c) => c.campaign === "repository-search")!;

  it("rolls visits, signups, activation, customers and spend into one campaign row", () => {
    expect(row).toMatchObject({
      channel: "Paid search",
      sessions: 4,
      ctaClicks: 1,
      signups: 2,
      activated: 1,
      customers: 1,
      spendCents: 20_000,
      visitToSignup: 50,
      costPerSignupCents: 10_000,
      cacCents: 20_000,
    });
  });

  it("keeps people who signed up before the window out of the cohort", () => {
    expect(result.totals.signups).toBe(3);
  });

  it("divides spend by paid-traffic results only", () => {
    expect(result.totals).toMatchObject({ spendCents: 20_000, paidSignups: 2, costPerSignupCents: 10_000, cacCents: 20_000, estMrrCents: 2900 });
  });

  it("breaks results down by landing page and keyword", () => {
    expect(result.landings.find((l) => l.name === "/for/research-repository")).toMatchObject({ sessions: 4, signups: 1, customers: 1 });
    expect(result.keywords[0]).toMatchObject({ name: "research repository", signups: 1 });
  });

  it("exports conversions for people who arrived with a click id, without personal details", () => {
    expect(result.conversions).toEqual([
      { at: "2026-11-03T10:00:00Z", type: "paid", clickId: "abc", clickIdType: "gclid", campaign: "repository-search" },
      { at: "2026-11-01T10:05:00Z", type: "signup", clickId: "abc", clickIdType: "gclid", campaign: "repository-search" },
    ]);
  });
});
