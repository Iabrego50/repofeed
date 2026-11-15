import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedModeContext } from "./feed-mode";
import { useFeedActions, useReelComments } from "./use-feed-data";

const bag = vi.hoisted(() => ({
  comments: vi.fn(),
  getComments: vi.fn(),
  deleteComment: vi.fn(),
  react: vi.fn(),
  guestReact: vi.fn(),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    share: { comments: (...args: unknown[]) => bag.comments(...args) },
    feed: {
      getComments: (...args: unknown[]) => bag.getComments(...args),
      deleteComment: (...args: unknown[]) => bag.deleteComment(...args),
      react: (...args: unknown[]) => bag.react(...args),
      guestReact: (...args: unknown[]) => bag.guestReact(...args),
    },
  },
}));

function Probe({ reelId }: { reelId: string }) {
  const comments = useReelComments(reelId);
  return <div>{comments?.map((c) => c.body).join(",") || "none"}</div>;
}

describe("useReelComments", () => {
  it("does not load comments for share viewers", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={{ kind: "share", token: "tok" }}>
          <Probe reelId="r1" />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("none")).toBeInTheDocument();
    expect(bag.comments).not.toHaveBeenCalled();
    expect(bag.getComments).not.toHaveBeenCalled();
  });
});

function WriteProbe() {
  const { react, deleteComment } = useFeedActions();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void react("r1", "true").catch((e: Error) => {
            (window as unknown as { __err?: string }).__err = e.message;
          })
        }
      >
        react
      </button>
      <button
        type="button"
        onClick={() =>
          void deleteComment("c1").catch((e: Error) => {
            (window as unknown as { __err?: string }).__err = e.message;
          })
        }
      >
        delete
      </button>
    </>
  );
}

describe("useFeedActions share writes", () => {
  it("refuses guest write RPCs for share-link viewers", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={{ kind: "share", token: "tok" }}>
          <WriteProbe />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    screen.getByRole("button", { name: /react/i }).click();
    await waitFor(() => {
      expect((window as unknown as { __err?: string }).__err).toMatch(/only watch/i);
    });
    expect(bag.guestReact).not.toHaveBeenCalled();
    expect(bag.react).not.toHaveBeenCalled();

    (window as unknown as { __err?: string }).__err = undefined;
    screen.getByRole("button", { name: /delete/i }).click();
    await waitFor(() => {
      expect((window as unknown as { __err?: string }).__err).toMatch(/only watch/i);
    });
    expect(bag.deleteComment).not.toHaveBeenCalled();
  });
});
