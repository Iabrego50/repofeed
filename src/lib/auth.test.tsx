import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const bag = vi.hoisted(() => ({
  client: null as null | {
    auth: {
      getSession: () => Promise<unknown>;
      onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } };
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
