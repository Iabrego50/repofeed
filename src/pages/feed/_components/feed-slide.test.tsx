import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FeedModeContext, type FeedMode } from "../_lib/feed-mode";
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

function shareMode(): FeedMode {
  return {
    kind: "share",
    token: "live-token",
    secret: null,
    ensureGuest: async () => null,
  };
}

function renderSlide(mode: "member" | "share") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value: FeedMode = mode === "share" ? shareMode() : { kind: "member" };

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeedModeContext.Provider value={value}>
          <div className="h-[600px]">
            <FeedSlide
              reel={reel}
              active
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
  it("share links: discussion/evidence + reactions — no save, topics, or study meta", () => {
    renderSlide("share");
    expect(screen.getByRole("button", { name: "React" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/more about checkout/i)).not.toBeInTheDocument();
    expect(screen.queryByText("#checkout")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /your reaction/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/open comments/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/open sources/i)).toBeInTheDocument();
    expect(screen.getByText("Cart drop-off")).toBeInTheDocument();
    expect(screen.queryByText("Checkout study")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/pause scene|play scene/i)).toBeInTheDocument();
  });

  it("members: Save + reactions — no topic tags or study meta", () => {
    renderSlide("member");
    expect(screen.getByLabelText(/save scene/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "React" })).toBeInTheDocument();
    expect(screen.getByLabelText(/open comments/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/open sources/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/more about checkout/i)).not.toBeInTheDocument();
    expect(screen.queryByText("#checkout")).not.toBeInTheDocument();
    expect(screen.getByText("Cart drop-off")).toBeInTheDocument();
    expect(screen.queryByText("Checkout study")).not.toBeInTheDocument();
  });
});
