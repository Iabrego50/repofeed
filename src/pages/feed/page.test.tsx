import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const bag = vi.hoisted(() => ({
  currentUser: vi.fn(),
  studiesList: vi.fn(),
  unreadIds: vi.fn(),
  feedList: vi.fn(),
  markSeen: vi.fn(),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    users: { current: (...a: unknown[]) => bag.currentUser(...a), update: vi.fn() },
    studies: { list: (...a: unknown[]) => bag.studiesList(...a) },
    studyViews: {
      unreadIds: (...a: unknown[]) => bag.unreadIds(...a),
      markSeen: (...a: unknown[]) => bag.markSeen(...a),
    },
    feed: {
      list: (...a: unknown[]) => bag.feedList(...a),
      saved: vi.fn(),
      getComments: vi.fn().mockResolvedValue([]),
      getEvidence: vi.fn().mockResolvedValue([]),
      react: vi.fn(),
      save: vi.fn(),
      unsave: vi.fn(),
      recordView: vi.fn(),
      addComment: vi.fn(),
      deleteComment: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) } },
  getBrowserSupabase: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  getSessionId: () => "test-session",
}));

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({
    current: { _id: "ws1", name: "Acme Research", role: "admin", seatOverage: false },
    isEditor: true,
  }),
}));

vi.mock("@/hooks/use-native-viewer.ts", () => ({
  useNativeViewer: () => ({ nativeViewerMode: false }),
}));

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: () => <div data-testid="reel-canvas" />,
}));

vi.mock("@/components/feed-tour.tsx", () => ({
  default: () => null,
}));

import FeedPage from "./page.tsx";

const reel = {
  _id: "r1",
  id: "r1",
  _creationTime: Date.now(),
  workspaceId: "ws1",
  studyId: "s1",
  position: 0,
  track: "t",
  trackIndex: 0,
  title: "Cart drop-off",
  scenes: [{ type: "hook", text: "People abandon the cart" }],
  findingIds: [],
  topics: [],
  sourceNames: [],
  footage: null,
  warning: null,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  studyTitle: "Checkout study",
  commentCount: 0,
  reactions: { heart: 0 },
};

function mockDesktop(desktop: boolean) {
  window.matchMedia = (query: string) => ({
    matches: desktop && query.includes("min-width: 1024px"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

function renderFeed() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/feed"]}>
        <Routes>
          <Route path="/feed" element={<FeedPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Researcher feed PowerPoint", () => {
  beforeEach(() => {
    bag.currentUser.mockResolvedValue({ onboardedAt: "2026-01-01T00:00:00.000Z" });
    bag.studiesList.mockResolvedValue([
      { _id: "s1", title: "Checkout study", status: "published" },
    ]);
    bag.unreadIds.mockResolvedValue([]);
    bag.feedList.mockResolvedValue([reel]);
    bag.markSeen.mockResolvedValue(undefined);
    mockDesktop(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Add to PPT and Generate PowerPoint on the researcher feed", async () => {
    renderFeed();
    expect(await screen.findByRole("button", { name: /add to ppt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^generate powerpoint$/i })).toBeInTheDocument();
  });

  it("lets a researcher add an insight and open the Presenter", async () => {
    const user = userEvent.setup();
    renderFeed();
    const add = await screen.findByRole("button", { name: /add to ppt/i });
    await user.click(add);
    expect(add).toHaveTextContent(/added to ppt/i);
    await user.click(screen.getByRole("button", { name: /generate powerpoint \(1\)/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /\.pptx|powerpoint/i })).toBeInTheDocument();
    });
  });
});
