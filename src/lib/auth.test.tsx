import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

type AuthListener = (event: string, session: unknown) => void;

const bag = vi.hoisted(() => ({
  client: null as null | {
    auth: {
      getSession: () => Promise<unknown>;
      onAuthStateChange: (cb: AuthListener) => {
        data: { subscription: { unsubscribe: () => void } };
      };
    };
    from?: (table: string) => unknown;
  },
}));

vi.mock("./supabase", () => ({
  getBrowserSupabase: () => bag.client,
  isSupabaseConfigured: () => bag.client !== null,
  ensureAuthStorageReady: async () => undefined,
}));

import { AppErrorBoundary } from "../components/app-error-boundary";
import { AuthProvider, useAuth } from "./auth";

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>auth-loading</div>;
  return <div>{user ? "signed-in" : "signed-out"}</div>;
}

describe("AuthProvider", () => {
  it("renders children when Supabase env is missing", async () => {
    bag.client = null;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
  });

  it("renders children when getSession fails", async () => {
    bag.client = {
      auth: {
        getSession: async () => {
          throw new Error("network down");
        },
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
    };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
  });

  it("keeps the stored session after getSession and ignores INITIAL_SESSION null", async () => {
    const session = { user: { id: "u1", email: "a@b.co" } };
    const holder: { current: AuthListener | null } = { current: null };
    bag.client = {
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: (cb: AuthListener) => {
          holder.current = cb;
          // Simulate the race that used to clear auth before hydration finished.
          queueMicrotask(() => cb("INITIAL_SESSION", null));
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: "u1", email: "a@b.co", name: "A", avatar: null } }),
          }),
        }),
      }),
    };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("signed-in")).toBeInTheDocument());
    // INITIAL_SESSION null must not wipe the hydrated session.
    holder.current?.("INITIAL_SESSION", null);
    expect(screen.getByText("signed-in")).toBeInTheDocument();
  });

  it("shows a readable fallback when useAuth has no provider", () => {
    render(
      <AppErrorBoundary>
        <Probe />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("This page hit a problem")).toBeInTheDocument();
    expect(screen.getByText(/useAuth must be used within an AuthProvider/)).toBeInTheDocument();
  });
});
