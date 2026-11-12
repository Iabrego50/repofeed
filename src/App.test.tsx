import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { APP_PATHS, PROTECTED_APP_PATHS, PUBLIC_APP_PATHS } from "./app-paths";

const { sessionBag, mockUser, bag, emptyInsightSummary } = vi.hoisted(() => {
  const mockUser = {
    id: "user-1",
    email: "tester@example.com",
    user_metadata: { name: "Test User", avatar_url: "" },
  };
  const sessionBag: {
    session: null | {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      user: typeof mockUser;
    };
  } = { session: null };

  const workspaceRow = {
    workspace_id: "ws1",
    role: "owner" as const,
    workspaces: {
      id: "ws1",
      name: "Acme Research",
      created_by: "user-1",
      customer_id: null,
      seat_variant: null,
      seats: null,
      paid_plan: null,
      lapsed_plan: null,
      seat_overage: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };

  function createQuery(result: { data: unknown; error: unknown; count?: number }) {
    const query: Record<string, unknown> = {};
    const self = () => query;
    for (const method of [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "order",
      "limit",
      "gte",
      "lte",
      "ilike",
      "or",
      "match",
      "filter",
      "not",
    ]) {
      query[method] = self;
    }
    query.maybeSingle = async () => {
      const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
      return { data, error: result.error };
    };
    query.single = async () => {
      const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
      return { data, error: data ? result.error : { message: "not found" } };
    };
    query.upsert = async () => result;
    query.update = async () => result;
    query.insert = async () => result;
    query.delete = async () => result;
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return query;
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session: sessionBag.session }, error: null }),
      getUser: async () => ({ data: { user: sessionBag.session?.user ?? null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
      signInWithOtp: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ data: { session: sessionBag.session }, error: null }),
      verifyOtp: async () => ({ data: { session: sessionBag.session }, error: sessionBag.session ? null : { message: "No session found" } }),
    },
    from(table: string) {
      if (table === "workspace_members" && sessionBag.session) {
        return createQuery({ data: [workspaceRow], error: null, count: 1 });
      }
      if (table === "users" && sessionBag.session) {
        return createQuery({
          data: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.user_metadata.name,
            avatar: null,
            onboarded_at: "2026-01-01T00:00:00.000Z",
            token_identifier: mockUser.id,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          error: null,
        });
      }
      if (table === "workspaces" && sessionBag.session) {
        return createQuery({ data: workspaceRow.workspaces, error: null, count: 1 });
      }
      return createQuery({ data: [], error: null, count: 0 });
    },
  };

  const emptyInsightSummary = {
    studies: [],
    reached: 0,
    guestsReached: 0,
    memberCount: 1,
    totalViews: 0,
    completionRate: 0,
    teamCompletionRate: 0,
    guestCompletionRate: 0,
    reactions: { true: 0, surprised: 0, pushback: 0 },
    openItems: 0,
    rows: [],
  };

  return { sessionBag, mockUser, bag: { client }, emptyInsightSummary };
});

vi.mock("@/lib/supabase", () => ({
  supabase: bag.client,
  getBrowserSupabase: () => bag.client,
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/api", () => ({
  api: {
    studies: { list: async () => [] },
    feed: { list: async () => [], saved: async () => [] },
    billing: {
      getPlan: async () => ({ plan: "free" }),
      data: {
        usage: async () => ({
          studies: 0,
          editors: 1,
          seats: null,
          interval: null,
          lapsedPlan: null,
          seatOverage: false,
          trialUsed: false,
        }),
      },
      checkout: async () => ({ url: null }),
      portal: async () => ({ url: "https://billing.stripe.com/p/session/test" }),
    },
    users: {
      current: async () => ({ onboardedAt: "2026-01-01T00:00:00.000Z" }),
      update: async () => undefined,
    },
    insights: { summary: async () => emptyInsightSummary },
  },
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    studies: {
      list: async () => [],
      get: async () => null,
      listSources: async () => [],
    },
    workspaces: {
      mine: async () => [{ _id: "ws1", id: "ws1", name: "Acme Research" }],
      listInvites: async () => [],
      listMembers: async () => [],
      peekInvite: async () => {
        throw new Error("Invite not found");
      },
      rename: async () => undefined,
    },
    feed: { list: async () => [], saved: async () => [] },
    share: {
      publicTokenForReel: async ({ reelId }: { reelId: string }) =>
        reelId === "shared-reel" ? "public-token" : null,
      feed: async () => null,
      join: async () => ({}),
    },
    billing: {
      data: { usage: async () => ({ studies: 0, editors: 1 }) },
      actions: {
        acceptInvite: async () => undefined,
        createInvite: async () => ({ token: "inv" }),
        createStudy: async () => ({ _id: "s1" }),
      },
    },
    users: {
      current: async () => ({ onboardedAt: "2026-01-01T00:00:00.000Z" }),
      update: async () => undefined,
    },
  },
}));

import App from "./App";

const unmatched: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function trackRouteWarnings(args: unknown[]) {
  const text = args.map(String).join(" ");
  if (/No routes matched/i.test(text)) unmatched.push(text);
}

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

async function assertVisible(path: string) {
  await waitFor(
    () => {
      const text = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
      expect(text.length, `expected visible copy at ${path}`).toBeGreaterThan(8);
    },
    { timeout: 4000 },
  );
  expect(unmatched, `No routes matched at ${path}`).toEqual([]);
  expect(document.body.textContent).not.toMatch(/useAuth must be used within an AuthProvider/);
  expect(document.body.innerHTML.length).toBeGreaterThan(0);
}

function signedInSession() {
  sessionBag.session = {
    access_token: "token",
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    user: mockUser,
  };
}

function signedOutSession() {
  sessionBag.session = null;
}

function internalPathsFromLanding(): string[] {
  const hrefs = [...document.querySelectorAll("a[href]")]
    .map((el) => el.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/") && !href.startsWith("//"));
  return [...new Set(hrefs.map((href) => new URL(href, "http://app.local").pathname))];
}

describe("App routes", () => {
  beforeEach(() => {
    unmatched.length = 0;
    signedOutSession();
    window.history.pushState({}, "", "/");
    warnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => {
      trackRouteWarnings(args);
    });
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      trackRouteWarnings(args);
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    cleanup();
  });

  it("renders the landing page at / without throwing", async () => {
    expect(() => renderAt("/")).not.toThrow();
    await waitFor(() => {
      expect(screen.getByText(/Nobody reads the report/i)).toBeInTheDocument();
    });
    expect(document.body.textContent).toMatch(/repofeed/i);
  });

  it("keeps / as the marketing landing when signed in, and puts the feed at /feed", async () => {
    signedInSession();
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/Nobody reads the report/i)).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/");
    expect(screen.getAllByRole("link", { name: /go to the feed/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/No scenes in your feed yet/i)).not.toBeInTheDocument();
    cleanup();

    signedInSession();
    renderAt("/feed");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/feed");
      expect(document.body.textContent).toMatch(/Acme Research/);
    });
    expect(document.body.textContent).not.toMatch(/Nobody reads the report/i);
    expect(document.title).toMatch(/Feed/);
  });

  it("sends a signed-in visitor from /signin to /feed", async () => {
    signedInSession();
    renderAt("/signin");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/feed");
      expect(document.body.textContent).toMatch(/Acme Research/);
    });
    expect(document.body.textContent).not.toMatch(/Nobody reads the report/i);
  });

  it("redirects /dashboard to /feed for a signed-in visitor", async () => {
    signedInSession();
    renderAt("/dashboard");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/feed");
      expect(document.body.textContent).toMatch(/Acme Research/);
    });
    expect(document.body.textContent).not.toMatch(/Nobody reads the report/i);
  });

  it("still shows the landing for a signed-out /?reel= link when sharing is off", async () => {
    renderAt("/?reel=reel-1");
    await waitFor(() => {
      expect(screen.getByText(/Nobody reads the report/i)).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/");
  });

  it("sends a signed-out /?reel= visitor to the public share URL when sharing is on", async () => {
    renderAt("/?reel=shared-reel");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/s/public-token");
      expect(window.location.search).toBe("?reel=shared-reel");
    });
  });

  it("crawls every internal landing href and every route without an unmatched warning", async () => {
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/Nobody reads the report/i)).toBeInTheDocument();
    });
    const landingPaths = internalPathsFromLanding();
    expect(landingPaths).toEqual(expect.arrayContaining(["/demo", "/help", "/signin"]));
    cleanup();

    const paths = [...new Set([...landingPaths, ...APP_PATHS, "/not-a-real-page"])];
    for (const path of paths) {
      unmatched.length = 0;
      signedOutSession();
      renderAt(path);
      await assertVisible(path);
      cleanup();
    }
  });

  it("redirects signed-out visitors from protected routes to sign-in", async () => {
    for (const path of PROTECTED_APP_PATHS) {
      unmatched.length = 0;
      renderAt(path);
      await waitFor(() => {
        expect(window.location.pathname).toBe("/signin");
        expect(screen.getByRole("heading", { name: /sign in to repofeed/i })).toBeInTheDocument();
      });
      expect(unmatched).toEqual([]);
      cleanup();
    }
  });

  it("renders public routes signed-out with visible copy", async () => {
    const expected: Record<string, RegExp> = {
      "/": /Nobody reads the report/i,
      "/for/research-repository": /research repository people open/i,
      "/demo": /Demo feed|Supperly/i,
      "/demo/insights": /Insights demo|Was the research watched/i,
      "/demo/explore": /Search the sample study|Explore demo/i,
      "/demo/deck": /Turn the sample study into a readout deck/i,
      "/help": /How can we help/i,
      "/terms": /terms of service/i,
      "/privacy": /privacy policy/i,
      "/signin": /Sign in to repofeed/i,
      "/login": /Sign in to repofeed/i,
      "/auth": /Sign in to repofeed/i,
      "/auth/callback": /Signing you in|Something went wrong|No session found|new link/i,
      "/auth/confirm": /Signing you in|Something went wrong|No session found|new link/i,
      "/s/test-token": /isn't available|No scenes here yet/i,
      "/share/test-token": /isn't available|No scenes here yet/i,
      "/invite/test-token": /Sign in to repofeed|invite no longer works|You're Invited/i,
    };

    for (const path of PUBLIC_APP_PATHS) {
      unmatched.length = 0;
      renderAt(path);
      const pattern = expected[path];
      await waitFor(() => {
        expect(document.body.textContent ?? "", path).toMatch(pattern);
      });
      expect(unmatched, path).toEqual([]);
      cleanup();
    }
  });

  it("renders protected routes signed-in with visible copy and no unmatched warning", async () => {
    signedInSession();
    for (const path of [...PROTECTED_APP_PATHS, "/", "/help"]) {
      unmatched.length = 0;
      signedInSession();
      renderAt(path);
      await assertVisible(path);
      expect(window.location.pathname === "/signin").toBe(false);
      cleanup();
    }
  });

  it("shows a real 404 page instead of an empty body", async () => {
    renderAt("/this-scene-is-missing");
    await waitFor(() => {
      expect(screen.getByText(/this scene doesn't exist/i)).toBeInTheDocument();
      expect(screen.getByText(/error 404/i)).toBeInTheDocument();
    });
    expect(unmatched).toEqual([]);
  });

  it("hides /admin/analytics from signed-out visitors as a 404", async () => {
    renderAt("/admin/analytics");
    await waitFor(() => {
      expect(screen.getByText(/this scene doesn't exist/i)).toBeInTheDocument();
    });
    expect(unmatched).toEqual([]);
    expect(document.body.textContent).not.toMatch(/Ad spend|Growth/i);
  });
});
