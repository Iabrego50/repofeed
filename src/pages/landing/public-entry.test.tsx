import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; user_metadata: Record<string, unknown> },
  loading: false,
}));

const nativeState = vi.hoisted(() => ({ native: false }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: authState.user,
    loading: authState.loading,
    isLoading: authState.loading,
  }),
}));

vi.mock("@/lib/native", () => ({
  isNativePlatform: () => nativeState.native,
  isNativeIos: () => nativeState.native,
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    share: { publicTokenForReel: vi.fn(async () => null) },
  },
}));

vi.mock("./page.tsx", () => ({
  default: () => <div>Marketing landing with pricing</div>,
}));

vi.mock("@/pages/help/page.tsx", () => ({
  default: () => <div>Help center</div>,
}));

vi.mock("@/components/viewer-onboarding/viewer-onboarding.tsx", () => ({
  default: () => <div>Viewer onboarding for invited teammates</div>,
}));

import PublicEntry from "./public-entry.tsx";
import {
  GUEST_STORY_DONE_KEY,
  STORY_META,
  VIEWER_ONBOARDING_DONE_KEY,
} from "@/lib/story-onboarding.ts";

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<PublicEntry loader={<div>loading</div>} />} />
          <Route path="/landing" element={<PublicEntry loader={<div>loading</div>} />} />
          <Route path="/welcome" element={<div>Product story welcome</div>} />
          <Route path="/feed" element={<div>App feed home</div>} />
          <Route path="/explore" element={<div>Native explore</div>} />
          <Route path="/join" element={<div>Join code</div>} />
          <Route path="/signin" element={<div>Sign in</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PublicEntry story-first routing", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.user = null;
    authState.loading = false;
    nativeState.native = false;
  });

  afterEach(() => cleanup());

  it("sends new signed-out web visitors from / to the product story", async () => {
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/Product story welcome/i)).toBeInTheDocument();
    });
  });

  it("does not force the story for guests who already finished it", async () => {
    localStorage.setItem(GUEST_STORY_DONE_KEY, "1");
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/Marketing landing with pricing/i)).toBeInTheDocument();
    });
  });

  it("lets signed-in users replay the story via /?story=1", async () => {
    authState.user = {
      id: "u1",
      user_metadata: { [STORY_META.completedAt]: "2026-01-01T00:00:00.000Z" },
    };
    renderAt("/?story=1");
    await waitFor(() => {
      expect(screen.getByText(/Product story welcome/i)).toBeInTheDocument();
    });
  });

  it("sends signed-in web users to the app home instead of the story", async () => {
    authState.user = {
      id: "u1",
      user_metadata: { [STORY_META.completedAt]: "2026-01-01T00:00:00.000Z" },
    };
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/App feed home/i)).toBeInTheDocument();
    });
  });

  it("serves the marketing page at /landing", async () => {
    renderAt("/landing");
    await waitFor(() => {
      expect(screen.getByText(/Marketing landing with pricing/i)).toBeInTheDocument();
    });
  });

  it("shows native viewer onboarding before join for new iOS visitors", async () => {
    nativeState.native = true;
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/Viewer onboarding for invited teammates/i)).toBeInTheDocument();
    });
  });

  it("skips native viewer onboarding once completed", async () => {
    nativeState.native = true;
    localStorage.setItem(VIEWER_ONBOARDING_DONE_KEY, "1");
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByText(/Sign in/i)).toBeInTheDocument();
    });
  });
});
