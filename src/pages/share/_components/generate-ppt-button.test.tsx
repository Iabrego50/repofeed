import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedReel } from "@/pages/feed/_lib/types.ts";
import { DeckSelectionProvider, useRequiredDeckSelection } from "../_lib/deck-selection.ts";
import GeneratePptButton from "./generate-ppt-button.tsx";

const reels: FeedReel[] = [
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
  {
    _id: "r2",
    id: "r2",
    _creationTime: Date.now(),
    workspaceId: "ws1",
    studyId: "s1",
    position: 1,
    track: "t",
    trackIndex: 1,
    title: "Shipping surprise",
    scenes: [{ type: "quote", text: "The fee showed up too late", by: "P11" }],
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
];

function Seed({ ids }: { ids: string[] }) {
  const deck = useRequiredDeckSelection();
  return (
    <button type="button" onClick={() => ids.forEach((id) => deck.toggle(id))}>
      seed
    </button>
  );
}

describe("GeneratePptButton", () => {
  afterEach(() => cleanup());

  it("renders nothing when nothing is selected", () => {
    const { container } = render(
      <DeckSelectionProvider>
        <GeneratePptButton studyTitle="Checkout" reels={reels} onPreview={vi.fn()} />
      </DeckSelectionProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("builds a deck from selected insights in feed order", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(
      <DeckSelectionProvider>
        <Seed ids={["r2", "r1"]} />
        <GeneratePptButton studyTitle="Checkout" reels={reels} onPreview={onPreview} />
      </DeckSelectionProvider>,
    );

    expect(screen.queryByRole("button", { name: /generate powerpoint/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "seed" }));
    expect(screen.getByRole("button", { name: /generate powerpoint \(2\)/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /generate powerpoint \(2\)/i }));

    expect(onPreview).toHaveBeenCalledTimes(1);
    const deck = onPreview.mock.calls[0][0];
    expect(deck.scopeLabel).toMatch(/checkout/i);
    expect(deck.reels.map((r: { id: string }) => r.id)).toEqual(["r1", "r2"]);
  });
});
