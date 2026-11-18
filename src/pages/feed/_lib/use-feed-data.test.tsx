import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedModeContext, type FeedMode } from "./feed-mode";
import { useFeedActions, useReelComments } from "./use-feed-data";

const bag = vi.hoisted(() => ({
  comments: vi.fn(),
  getComments: vi.fn(),
  deleteComment: vi.fn(),
  react: vi.fn(),
  guestReact: vi.fn(),
  guestAddComment: vi.fn(),
  addComment: vi.fn(),
  ensureGuest: vi.fn(),
}));

beforeEach(() => {
  bag.comments.mockReset();
  bag.getComments.mockReset();
  bag.deleteComment.mockReset();
  bag.react.mockReset();
  bag.guestReact.mockReset();
  bag.guestAddComment.mockReset();
  bag.addComment.mockReset();
  bag.ensureGuest.mockReset();
});

vi.mock("@/lib/api/complete", () => ({
  api: {
    share: { comments: (...args: unknown[]) => bag.comments(...args) },
    feed: {
      getComments: (...args: unknown[]) => bag.getComments(...args),
      deleteComment: (...args: unknown[]) => bag.deleteComment(...args),
      react: (...args: unknown[]) => bag.react(...args),
      guestReact: (...args: unknown[]) => bag.guestReact(...args),
      guestAddComment: (...args: unknown[]) => bag.guestAddComment(...args),
      addComment: (...args: unknown[]) => bag.addComment(...args),
    },
  },
}));

function shareMode(overrides?: Partial<Extract<FeedMode, { kind: "share" }>>): FeedMode {
  return {
    kind: "share",
    token: "tok",
    secret: null,
    ensureGuest: (...args: unknown[]) => bag.ensureGuest(...args),
    ...overrides,
  };
}

function Probe({ reelId }: { reelId: string }) {
  const comments = useReelComments(reelId);
  return <div>{comments?.map((c) => c.body).join(",") || "none"}</div>;
}

describe("useReelComments", () => {
  it("loads share_comments for share viewers", async () => {
    bag.comments.mockResolvedValue([{ body: "hello from share" }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={shareMode()}>
          <Probe reelId="r1" />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("hello from share")).toBeInTheDocument();
    expect(bag.comments).toHaveBeenCalledWith({ token: "tok", reelId: "r1" });
    expect(bag.getComments).not.toHaveBeenCalled();
  });

  it("loads member comments for workspace members", async () => {
    bag.getComments.mockResolvedValue([{ body: "member note" }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={{ kind: "member" }}>
          <Probe reelId="r1" />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("member note")).toBeInTheDocument();
    expect(bag.getComments).toHaveBeenCalledWith({ reelId: "r1" });
    expect(bag.comments).not.toHaveBeenCalled();
  });
});

function WriteProbe() {
  const { react, deleteComment, addComment } = useFeedActions();
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
          void addComment({ reelId: "r1", kind: "note", body: "hi" }).catch((e: Error) => {
            (window as unknown as { __err?: string }).__err = e.message;
          })
        }
      >
        comment
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
  it("joins then posts a comment when there is no stored secret", async () => {
    bag.ensureGuest.mockResolvedValue("fresh-secret");
    bag.guestAddComment.mockResolvedValue({
      _id: "c1",
      id: "c1",
      body: "hi",
      author: { name: "Priya" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={shareMode({ secret: null })}>
          <WriteProbe />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    screen.getByRole("button", { name: /comment/i }).click();
    await waitFor(() => {
      expect(bag.ensureGuest).toHaveBeenCalled();
      expect(bag.guestAddComment).toHaveBeenCalledWith({
        reelId: "r1",
        kind: "note",
        body: "hi",
        token: "tok",
        secret: "fresh-secret",
      });
    });
    expect(bag.addComment).not.toHaveBeenCalled();
  });

  it("skips the name prompt when a guest secret is already stored", async () => {
    bag.ensureGuest.mockResolvedValue("stored-secret");
    bag.guestAddComment.mockResolvedValue({ _id: "c1", id: "c1", body: "hi" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={shareMode({ secret: "stored-secret" })}>
          <WriteProbe />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    screen.getByRole("button", { name: /comment/i }).click();
    await waitFor(() => {
      expect(bag.guestAddComment).toHaveBeenCalledWith(
        expect.objectContaining({ secret: "stored-secret" }),
      );
    });
  });

  it("allows guest reactions via share_react", async () => {
    bag.ensureGuest.mockResolvedValue("sec");
    bag.guestReact.mockResolvedValue("true");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={shareMode()}>
          <WriteProbe />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    screen.getByRole("button", { name: /react/i }).click();
    await waitFor(() => {
      expect(bag.guestReact).toHaveBeenCalledWith({
        reelId: "r1",
        kind: "true",
        token: "tok",
        secret: "sec",
      });
    });
    expect(bag.react).not.toHaveBeenCalled();
  });

  it("refuses delete for share-link viewers", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeedModeContext.Provider value={shareMode()}>
          <WriteProbe />
        </FeedModeContext.Provider>
      </QueryClientProvider>,
    );
    (window as unknown as { __err?: string }).__err = undefined;
    screen.getByRole("button", { name: /delete/i }).click();
    await waitFor(() => {
      expect((window as unknown as { __err?: string }).__err).toMatch(/only watch/i);
    });
    expect(bag.deleteComment).not.toHaveBeenCalled();
  });
});
