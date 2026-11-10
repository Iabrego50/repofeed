import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const bag = vi.hoisted(() => ({
  client: null as null | {
    auth: {
      getSession: () => Promise<unknown>;
      onAuthStateChange: () => {
        data: { subscription: { unsubscribe: () => void } };
      };
    };
    from?: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          single: () => Promise<unknown>;
        };
      };
    };
  },
}));

vi.mock("./supabase", () => ({
  getBrowserSupabase: () => bag.client,
  isSupabaseConfigured: () => bag.client !== null,
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
    await waitFor(() =>
      expect(screen.getByText("signed-out")).toBeInTheDocument(),
    );
  });

  it("renders children when getSession fails", async () => {
    bag.client = {
      auth: {
        getSession: async () => {
          throw new Error("network down");
        },
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => undefined } },
        }),
      },
    };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("signed-out")).toBeInTheDocument(),
    );
  });

  it("unblocks routing after getSession even if the profile query is still pending", async () => {
    let finishProfile: (value: { data: unknown }) => void = () => undefined;
    const profileQuery = new Promise<{ data: unknown }>((resolve) => {
      finishProfile = resolve;
    });
    bag.client = {
      auth: {
        getSession: async () => ({
          data: {
            session: { user: { id: "user-1", email: "founder@example.com" } },
          },
          error: null,
        }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => undefined } },
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => profileQuery,
          }),
        }),
      }),
    };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("signed-in")).toBeInTheDocument(),
    );
    finishProfile({
      data: {
        id: "user-1",
        email: "founder@example.com",
        name: "Founder",
        avatar: null,
      },
    });
  });

  it("shows a readable fallback when useAuth has no provider", () => {
    render(
      <AppErrorBoundary>
        <Probe />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/useAuth must be used within an AuthProvider/),
    ).toBeInTheDocument();
  });
});
