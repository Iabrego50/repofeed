import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FeedModeContext } from "../_lib/feed-mode";
import type { FeedReel } from "../_lib/types";
import FeedSlide from "./feed-slide";

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: () => <div data-testid="reel-canvas" />,
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    feed: {
      save: vi.fn(),
      unsave: vi.fn(),
      react: vi.fn(),
      guestReact: vi.fn(),
    },
  },
}));

const reel: FeedReel = {
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
  topics: ["checkout"],
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

function renderSlide(mode: "member" | "share") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value =
    mode === "share"
      ? {
          kind: "share" as const,
          token: "live-token",
          secret: null,
          ensureGuest: async () => null,
        }
      : { kind: "member" as const };

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeedModeContext.Provider value={value}>
          <div className="h-[600px]">
            <FeedSlide
              reel={reel}
              active
              isNew={false}
              onEnded={() => undefined}
              onOpenPanel={() => undefined}
              onExport={() => undefined}
            />
          </div>
        </FeedModeContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FeedSlide access", () => {
  it("hides Save and Explore topic links on share links", () => {
    renderSlide("share");
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/more about checkout/i)).not.toBeInTheDocument();
    expect(screen.getByText("#checkout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "React" })).toBeInTheDocument();
  });

  it("shows Save and Explore topic links for members", () => {
    renderSlide("member");
    expect(screen.getByLabelText(/save scene/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/more about checkout/i)).toBeInTheDocument();
  });
});
