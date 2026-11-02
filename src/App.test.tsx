import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const bag = vi.hoisted(() => {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    in() {
      return query;
    },
    is() {
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
  };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
      signInWithOtp: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => query,
  };
  return { client };
});

vi.mock("@/lib/supabase", () => ({
  supabase: bag.client,
  getBrowserSupabase: () => bag.client,
  isSupabaseConfigured: () => true,
}));

import App from "./App";

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("App public routes", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the landing page at / without throwing", async () => {
    expect(() => renderAt("/")).not.toThrow();
    await waitFor(() => {
      expect(screen.getByText(/Nobody reads the report/i)).toBeInTheDocument();
    });
    expect(document.body.textContent).toMatch(/repofeed/i);
    expect(document.body.textContent).not.toMatch(/useAuth must be used within an AuthProvider/);
  });

  it("renders privacy, terms, share, and invite without throwing", async () => {
    expect(() => renderAt("/privacy")).not.toThrow();
    await waitFor(() => expect(screen.getByRole("heading", { name: /privacy policy/i })).toBeInTheDocument());
    cleanup();

    expect(() => renderAt("/terms")).not.toThrow();
    await waitFor(() => expect(screen.getByRole("heading", { name: /terms of service/i })).toBeInTheDocument());
    cleanup();

    expect(() => renderAt("/share/test-token")).not.toThrow();
    await waitFor(() => expect(screen.getByText(/isn't available|No scenes here yet/i)).toBeInTheDocument());
    cleanup();

    expect(() => renderAt("/invite/test-token")).not.toThrow();
    await waitFor(() => {
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
    });
    expect(document.body.textContent).not.toMatch(/useAuth must be used within an AuthProvider/);
  });
});
