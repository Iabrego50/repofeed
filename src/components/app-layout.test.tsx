import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bag = vi.hoisted(() => ({
  isEditor: true,
  loading: false,
  nativeViewerMode: false,
  current: { _id: "ws1", id: "ws1", name: "Acme Research", role: "owner" as string },
}));

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({
    workspaces: bag.current ? [bag.current] : [],
    current: bag.loading ? null : bag.current,
    setCurrent: vi.fn(),
    isEditor: bag.isEditor,
    isOwner: bag.isEditor,
    loading: bag.loading,
    refresh: async () => [],
  }),
}));

vi.mock("@/hooks/use-auth.ts", () => ({
  useAuth: () => ({
    signout: vi.fn(),
    signOut: vi.fn(),
    email: "tester@example.com",
  }),
  useUser: () => ({
    name: "Test User",
    email: "tester@example.com",
    avatar: "",
  }),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    users: { current: async () => ({ onboardedAt: "2026-01-01T00:00:00.000Z" }) },
    studyViews: { unreadIds: async () => [] },
  },
}));

vi.mock("@/hooks/use-native-viewer.ts", () => ({
  useNativeViewer: () => ({
    isAdmin: false,
    nativeViewerMode: bag.nativeViewerMode,
    nativeAdminAccess: false,
    loading: false,
    profile: null,
  }),
}));

vi.mock("@/lib/native", () => ({
  isNativePlatform: () => bag.nativeViewerMode,
}));

vi.mock("@/components/shell/command-palette.tsx", () => ({
  default: () => null,
  openSearch: vi.fn(),
}));

vi.mock("@/components/guide/guide.tsx", () => ({
  default: () => null,
  openGuide: vi.fn(),
}));

vi.mock("@/components/offline-banner.tsx", () => ({
  default: () => null,
}));

vi.mock("@/components/plan-notices.tsx", () => ({
  default: () => null,
}));

import AppLayout from "./app-layout";

function renderLayout(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/feed" element={<div>Feed page</div>} />
            <Route path="/explore" element={<div>Explore page</div>} />
            <Route path="/settings" element={<div>Settings page</div>} />
            <Route path="/help" element={<div>Help page</div>} />
            <Route path="/studies" element={<div>Studies page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppLayout viewer vs editor", () => {
  beforeEach(() => {
    bag.isEditor = true;
    bag.loading = false;
    bag.nativeViewerMode = false;
    bag.current = { _id: "ws1", id: "ws1", name: "Acme Research", role: "owner" };
  });

  it("shows the sidebar and mobile bottom nav for owners and editors", () => {
    bag.isEditor = true;
    renderLayout("/feed");
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
    expect(screen.getByText("Feed page")).toBeInTheDocument();
    expect(screen.getByText("Product tour")).toBeInTheDocument();
    expect(screen.getByText("Help Center")).toBeInTheDocument();
  });

  it("hides the sidebar and bottom tabs for members and keeps the feed", () => {
    bag.isEditor = false;
    bag.current = { _id: "ws1", id: "ws1", name: "Shared Workspace", role: "member" };
    renderLayout("/feed");
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByText("Feed page")).toBeInTheDocument();
    expect(screen.getByText("Shared Workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Account menu")).toBeInTheDocument();
    expect(screen.queryByText("Product tour")).not.toBeInTheDocument();
    expect(screen.queryByText("Help Center")).not.toBeInTheDocument();
  });

  it("redirects members from /explore to /feed", async () => {
    bag.isEditor = false;
    bag.current = { _id: "ws1", id: "ws1", name: "Shared Workspace", role: "member" };
    renderLayout("/explore");
    await waitFor(() => {
      expect(screen.getByText("Feed page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Explore page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
  });

  it("allows /feed?view=saved for members without redirecting away", () => {
    bag.isEditor = false;
    bag.current = { _id: "ws1", id: "ws1", name: "Shared Workspace", role: "member" };
    renderLayout("/feed?view=saved");
    expect(screen.getByText("Feed page")).toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
  });

  it("waits for workspace role before choosing a layout", () => {
    bag.loading = true;
    bag.current = { _id: "ws1", id: "ws1", name: "Acme Research", role: "owner" };
    bag.isEditor = true;
    renderLayout("/feed");
    expect(screen.getByTestId("layout-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByText("Feed page")).not.toBeInTheDocument();
  });

  it("native viewers stay on the feed with a profile menu and no Settings route", async () => {
    bag.nativeViewerMode = true;
    bag.isEditor = false;
    bag.current = { _id: "ws1", id: "ws1", name: "Shared Workspace", role: "member" };
    renderLayout("/settings");
    await waitFor(() => {
      expect(screen.getByText("Feed page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Settings page")).not.toBeInTheDocument();
    expect(screen.getByTestId("native-account-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("native-settings-icon")).not.toBeInTheDocument();
  });
});
