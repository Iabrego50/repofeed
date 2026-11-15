import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const bag = vi.hoisted(() => ({
  feed: vi.fn(),
  join: vi.fn(),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    share: {
      feed: (...args: unknown[]) => bag.feed(...args),
      join: (...args: unknown[]) => bag.join(...args),
    },
  },
}));

import SharePage from "./page";

function renderShare(token: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<SharePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Share page", () => {
  it("shows the unavailable screen when the RPC returns null", async () => {
    bag.feed.mockResolvedValue(null);
    renderShare("dead-token");
    expect(await screen.findByText(/this link isn't available/i)).toBeInTheDocument();
  });

  it("shows published scenes for a signed-out visitor", async () => {
    bag.feed.mockResolvedValue({
      studyTitle: "Checkout study",
      hideTeamComments: true,
      guest: null,
      reels: [
        {
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
        },
      ],
    });
    renderShare("live-token");
    await waitFor(() => {
      expect(bag.feed).toHaveBeenCalledWith({ token: "live-token", secret: undefined });
    });
    expect((await screen.findAllByText("Checkout study")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/this link isn't available/i)).not.toBeInTheDocument();
  });
});
