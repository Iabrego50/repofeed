import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedModeContext } from "./feed-mode";
import { useReelComments } from "./use-feed-data";

const bag = vi.hoisted(() => ({
  comments: vi.fn(),
  getComments: vi.fn(),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    share: { comments: (...args: unknown[]) => bag.comments(...args) },
    feed: { getComments: (...args: unknown[]) => bag.getComments(...args) },
  },
}));

function Probe({ reelId }: { reelId: string }) {
  const comments = useReelComments(reelId);
  return <div>{comments?.map((c) => c.body).join(",") || "none"}</div>;
}

describe("useReelComments", () => {
  it("loads share comments with the token instead of the member API", async () => {
    bag.comments.mockResolvedValue([
      {
        _id: "c1",
        id: "c1",
        body: "from a guest",
        reelId: "r1",
        studyId: "s1",
        userId: null,
        guestId: "g1",
        parentId: null,
        kind: "note",
        resolved: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        _creationTime: 0,
      },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider
          value={{ kind: "share", token: "tok", secret: "sec", ensureGuest: async () => "sec" }}
        >
          <Probe reelId="r1" />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(bag.comments).toHaveBeenCalledWith({ token: "tok", reelId: "r1" }));
    expect(bag.getComments).not.toHaveBeenCalled();
    expect(await screen.findByText("from a guest")).toBeInTheDocument();
  });
});
