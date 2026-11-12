import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAnalyticsSnapshot } from "@/lib/api/admin-analytics.ts";

const bag = vi.hoisted(() => ({
  auth: "ok" as "ok" | "signed-out",
}));

vi.mock("@/lib/api/bearer", () => ({
  jsonAuthHeaders: async () => {
    if (bag.auth === "signed-out") throw new Error("Not authenticated");
    return { Authorization: "Bearer test", "Content-Type": "application/json" };
  },
}));

import AdminAnalyticsPage from "./analytics.tsx";

function snapshot(): AdminAnalyticsSnapshot {
  return {
    range: "30d",
    excludeInternal: true,
    generatedAt: "2026-11-09T12:00:00.000Z",
    headlines: {
      users: 4,
      usersLifetime: 9,
      workspaces: 2,
      studies: 3,
      reels: 11,
      videosGenerated: 5,
      active7d: 2,
      active30d: 3,
      viewsInRange: 18,
    },
    signups: {
      total: 4,
      byDay: [{ day: "2026-11-08", signups: 4 }],
      bySource: [{ name: "google", count: 3 }, { name: "direct", count: 1 }],
      byReferrer: [{ name: "(direct)", count: 4 }],
    },
    funnel: [
      { key: "signup", label: "Signed up", count: 4 },
      { key: "paid", label: "Paid", count: 0 },
    ],
    engagement: { views: 40, viewers: 12, hearts: 2, saves: 1, comments: 0, evidenceOpens: 3 },
    demo: { sessions: 6, interacted: 2, signedUp: 1 },
    generation: {
      studyJobs: { done: 3, failed: 0, successRate: 100, avgSeconds: 40 },
      videos: { completed: 5, failed: 1, successRate: 83.3, avgSeconds: 20, byProvider: [] },
    },
    plans: { mix: [{ name: "free", count: 2 }], paidWorkspaces: 0, usage: [] },
    product: {
      visits: 20,
      viewsInRange: 18,
      viewersInRange: 7,
      daily: [
        { day: "2026-11-08", signups: 4, studies: 3, reels: 11, views: 18 },
        { day: "2026-11-09", signups: 0, studies: 0, reels: 0, views: 0 },
      ],
      funnel: [
        { key: "visit", label: "Visited", count: 20 },
        { key: "signup", label: "Signed up", count: 4 },
        { key: "first_study", label: "Started a study", count: 2 },
        { key: "first_reel", label: "Generated a scene", count: 1 },
      ],
    },
    acquisition: {
      totals: {
        sessions: 20,
        paidSessions: 8,
        signups: 4,
        paidSignups: 3,
        activated: 2,
        customers: 0,
        spendCents: 0,
        costPerSignupCents: null,
        cacCents: null,
        visitToSignup: 20,
        estMrrCents: 0,
      },
      channels: [],
      campaigns: [],
      creatives: [],
      keywords: [],
      landings: [],
      daily: [{ day: "2026-11-08", sessions: 20, signups: 4, customers: 0 }],
      conversions: [],
      spend: [],
    },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <AdminAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("founder analytics page", () => {
  beforeEach(() => {
    bag.auth = "ok";
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the public 404 when the visitor is signed out", async () => {
    bag.auth = "signed-out";
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/this scene doesn't exist/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/product analytics/i)).not.toBeInTheDocument();
  });

  it("shows the public 404 when the API hides the route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/this scene doesn't exist/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/product analytics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ad spend/i)).not.toBeInTheDocument();
  });

  it("renders founder metrics when an admin snapshot loads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(snapshot()), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /product analytics/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Started a study")).toBeInTheDocument();
    expect(screen.getByText("Generated a scene")).toBeInTheDocument();
    expect(screen.getAllByText("Signups").length).toBeGreaterThan(0);
    expect(screen.getByText(/hide my own activity/i)).toBeInTheDocument();
    expect(screen.queryByText(/this scene doesn't exist/i)).not.toBeInTheDocument();
  });
});
