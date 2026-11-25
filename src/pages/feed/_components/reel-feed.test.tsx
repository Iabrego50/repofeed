import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FeedModeContext, type FeedMode } from "../_lib/feed-mode";
import type { FeedReel } from "../_lib/types";

const bag = vi.hoisted(() => ({
  getComments: vi.fn(),
  getEvidence: vi.fn(),
  shareComments: vi.fn(),
  shareEvidence: vi.fn(),
  ensureGuest: vi.fn(),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    feed: {
      getComments: (...args: unknown[]) => bag.getComments(...args),
      getEvidence: (...args: unknown[]) => bag.getEvidence(...args),
      react: vi.fn(),
      guestReact: vi.fn(),
      save: vi.fn(),
      unsave: vi.fn(),
      recordView: vi.fn(),
      addComment: vi.fn(),
      guestAddComment: vi.fn(),
      deleteComment: vi.fn(),
    },
    share: {
      comments: (...args: unknown[]) => bag.shareComments(...args),
      evidence: (...args: unknown[]) => bag.shareEvidence(...args),
    },
  },
}));

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: () => <div data-testid="reel-canvas" />,
}));

vi.mock("@/components/reel/export-dialog.tsx", () => ({
  default: ({ reel }: { reel: unknown }) =>
    reel ? <div data-testid="export-dialog">Export</div> : null,
}));

import ReelFeed from "./reel-feed";

const reel: FeedReel = {
  _id: "r1",
  id: "r1",
  _creationTime: Date.now(),
  workspaceId: "ws1",
  studyId: "s1",
  position: 0,
  track: "Findings",
  trackIndex: 0,
  title: "Cart drop-off",
  scenes: [{ type: "hook", text: "People abandon the cart" }],
  findingIds: [],
  topics: ["checkout"],
  sourceNames: ["interview-1.pdf"],
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

function shareMode(): FeedMode {
  return {
    kind: "share",
    token: "live-token",
    secret: null,
    ensureGuest: (...args: unknown[]) => bag.ensureGuest(...args) as Promise<string | null>,
  };
}

function renderFeed(mode: "member" | "share") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const value: FeedMode = mode === "share" ? shareMode() : { kind: "member" };

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeedModeContext.Provider value={value}>
          <div className="h-[800px]">
            <ReelFeed
              reels={[reel]}
              deepLink={null}
              empty={<p>Empty</p>}
            />
          </div>
        </FeedModeContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReelFeed panels", () => {
  beforeEach(() => {
    bag.getComments.mockReset().mockResolvedValue([]);
    bag.getEvidence.mockReset().mockResolvedValue([]);
    bag.shareComments.mockReset().mockResolvedValue([]);
    bag.shareEvidence.mockReset().mockResolvedValue([]);
    bag.ensureGuest.mockReset().mockResolvedValue(null);
    mockDesktop(true);
  });

  afterEach(() => {
    mockDesktop(false);
    cleanup();
  });

  it("share mode shows the composer and hides export/save", async () => {
    renderFeed("share");

    const panel = await screen.findByRole("tablist", { name: /scene details/i });
    expect(panel).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /discussion/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /evidence/i })).toBeInTheDocument();

    expect(
      await screen.findByPlaceholderText(/ask a question or leave a note/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /comment type/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^post$/i })).toBeInTheDocument();
    expect(screen.queryByTestId("export-dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^like$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /heard this before/i })).toBeInTheDocument();

    expect(bag.shareComments).toHaveBeenCalledWith({
      token: "live-token",
      reelId: "r1",
    });
    expect(bag.getComments).not.toHaveBeenCalled();
  });

  it("member mode keeps the composer and the four stream actions", async () => {
    renderFeed("member");

    const panel = await screen.findByRole("tablist", { name: /scene details/i });
    expect(panel).toBeInTheDocument();

    expect(
      await screen.findByPlaceholderText(/ask a question or leave a note/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /comment type/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^like$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /heard this before/i })).toBeInTheDocument();
    expect(screen.queryByTestId("export-dialog")).not.toBeInTheDocument();

    expect(bag.getComments).toHaveBeenCalledWith({ reelId: "r1" });
    expect(bag.shareComments).not.toHaveBeenCalled();
  });

  it("share mode opens the mobile bottom sheet with a composer", async () => {
    mockDesktop(false);
    const user = userEvent.setup();
    renderFeed("share");

    expect(screen.queryByRole("tablist", { name: /scene details/i })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/open comments/i));

    const dialog = await screen.findByRole("dialog", {
      name: /scene discussion and evidence/i,
    });
    expect(within(dialog).getByRole("tab", { name: /discussion/i })).toBeInTheDocument();
    expect(
      await within(dialog).findByPlaceholderText(/ask a question or leave a note/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("radiogroup", { name: /comment type/i })).toBeInTheDocument();
  });
});
