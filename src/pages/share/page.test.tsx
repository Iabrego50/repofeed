import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const bag = vi.hoisted(() => ({
  feed: vi.fn(),
  join: vi.fn(),
  shareComments: vi.fn(),
  shareEvidence: vi.fn(),
  guestAddComment: vi.fn(),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    share: {
      feed: (...args: unknown[]) => bag.feed(...args),
      join: (...args: unknown[]) => bag.join(...args),
      comments: (...args: unknown[]) => bag.shareComments(...args),
      evidence: (...args: unknown[]) => bag.shareEvidence(...args),
    },
    feed: {
      guestAddComment: (...args: unknown[]) => bag.guestAddComment(...args),
      guestReact: vi.fn(),
      react: vi.fn(),
      save: vi.fn(),
      unsave: vi.fn(),
      recordView: vi.fn(),
      addComment: vi.fn(),
      deleteComment: vi.fn(),
      getComments: vi.fn(),
      getEvidence: vi.fn(),
    },
  },
}));

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: () => <div data-testid="reel-canvas" />,
}));

import SharePage from "./page";

const SECRET_KEY = (token: string) => `fieldreel.guest.${token}`;

const feedPayload = {
  studyTitle: "Checkout study",
  hideTeamComments: true,
  guest: null as null | { id: string; name: string },
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
      commentCount: 0,
      reactions: { heart: 0 },
    },
  ],
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

function renderShare(token: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
  beforeEach(() => {
    localStorage.clear();
    bag.feed.mockReset();
    bag.join.mockReset();
    bag.shareComments.mockReset().mockResolvedValue([]);
    bag.shareEvidence.mockReset().mockResolvedValue([]);
    bag.guestAddComment.mockReset();
    mockDesktop(true);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows the unavailable screen when the RPC returns null", async () => {
    bag.feed.mockResolvedValue(null);
    renderShare("dead-token");
    expect(await screen.findByText(/this link isn't available/i)).toBeInTheDocument();
  });

  it("shows a share feed with composer entry points and no researcher tools or study meta chrome", async () => {
    bag.feed.mockResolvedValue({ ...feedPayload, guest: null });
    renderShare("live-token");
    await waitFor(() => {
      expect(bag.feed).toHaveBeenCalledWith({ token: "live-token", secret: undefined });
    });
    expect((await screen.findAllByText("Cart drop-off")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Checkout study")).not.toBeInTheDocument();
    expect(screen.queryByText(/this link isn't available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/made with repofeed/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/open comments/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^like$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /heard this before/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/open sources/i)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /add to ppt/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate powerpoint/i })).not.toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText(/ask a question or leave a note/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/your name/i)).not.toBeInTheDocument();
    expect(bag.join).not.toHaveBeenCalled();
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("lets a guest add insights and generate a PowerPoint deck", async () => {
    const user = userEvent.setup();
    bag.feed.mockResolvedValue({
      ...feedPayload,
      reels: [
        ...feedPayload.reels,
        {
          ...feedPayload.reels[0],
          _id: "r2",
          id: "r2",
          title: "Shipping surprise",
          scenes: [
            { type: "quote", text: "The fee showed up too late", by: "P11" },
            { type: "cta", text: "Show shipping earlier." },
          ],
        },
      ],
    });
    renderShare("live-token");
    const add = (await screen.findAllByRole("button", { name: /add to ppt/i }))[0];
    await user.click(add);
    expect(add).toHaveTextContent(/added to ppt/i);
    expect(screen.getByRole("button", { name: /generate powerpoint \(1\)/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /generate powerpoint \(1\)/i }));
    expect(await screen.findByRole("button", { name: /\.pptx|powerpoint/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/create a new version/i)).not.toBeInTheDocument();
  });

  it("asks for a name on first post, then joins and adds a comment", async () => {
    const user = userEvent.setup();
    bag.feed.mockImplementation(async (args: { token: string; secret?: string }) => {
      if (args.secret === "new-secret") {
        return {
          ...feedPayload,
          guest: { id: "g1", name: "Priya" },
        };
      }
      return { ...feedPayload, guest: null };
    });
    bag.join.mockResolvedValue({ secret: "new-secret", guestId: "g1" });
    bag.guestAddComment.mockResolvedValue({
      _id: "c1",
      id: "c1",
      _creationTime: Date.now(),
      reelId: "r1",
      studyId: "",
      userId: null,
      guestId: null,
      parentId: null,
      kind: "note",
      body: "Looks right",
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { name: "Priya" },
    });

    renderShare("live-token");
    const composer = await screen.findByPlaceholderText(/ask a question or leave a note/i);
    await user.type(composer, "Looks right");
    await user.click(screen.getByRole("button", { name: /^post$/i }));

    expect(await screen.findByText(/what should we call you/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/your name/i), "Priya");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(bag.join).toHaveBeenCalledWith({ token: "live-token", name: "Priya" });
      expect(bag.guestAddComment).toHaveBeenCalledWith(
        expect.objectContaining({
          reelId: "r1",
          kind: "note",
          body: "Looks right",
          token: "live-token",
          secret: "new-secret",
        }),
      );
    });
    expect(localStorage.getItem(SECRET_KEY("live-token"))).toBe("new-secret");
  });

  it("skips the name prompt when a guest secret is already stored", async () => {
    const user = userEvent.setup();
    localStorage.setItem(SECRET_KEY("live-token"), "stored-secret");
    bag.feed.mockResolvedValue({
      ...feedPayload,
      guest: { id: "g1", name: "Priya" },
    });
    bag.guestAddComment.mockResolvedValue({
      _id: "c1",
      id: "c1",
      _creationTime: Date.now(),
      reelId: "r1",
      studyId: "",
      userId: null,
      guestId: null,
      parentId: null,
      kind: "note",
      body: "Again",
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { name: "Priya" },
    });

    renderShare("live-token");
    await waitFor(() => {
      expect(bag.feed).toHaveBeenCalledWith({
        token: "live-token",
        secret: "stored-secret",
      });
    });

    const composer = await screen.findByPlaceholderText(/ask a question or leave a note/i);
    await user.type(composer, "Again");
    await user.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => {
      expect(bag.guestAddComment).toHaveBeenCalledWith(
        expect.objectContaining({ secret: "stored-secret", body: "Again" }),
      );
    });
    expect(bag.join).not.toHaveBeenCalled();
    expect(screen.queryByText(/what should we call you/i)).not.toBeInTheDocument();
  });
});
