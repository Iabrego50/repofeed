import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Deck } from "../_lib/deck.ts";
import Slide from "./slide.tsx";

function deckWith(creationTime: unknown): Deck {
  return {
    id: "d1",
    scopeLabel: "Checkout study",
    _creationTime: creationTime,
    slides: [
      {
        type: "title",
        headline: "Why carts are abandoned",
        body: "Findings from the shared study.",
      },
    ],
    reels: [],
    stats: {
      reached: 0,
      memberCount: 0,
      guestsReached: 0,
      completionRate: 0,
      openItems: 0,
      totalViews: 0,
      reactions: { true: 0, surprised: 0, pushback: 0 },
    },
  };
}

describe("CoverSlide date safety", () => {
  afterEach(() => cleanup());

  it("renders the title slide when _creationTime is missing or invalid", () => {
    for (const bad of [undefined, null, Number.NaN, "", "not-a-date"]) {
      cleanup();
      expect(() =>
        render(
          <Slide
            deck={deckWith(bad)}
            slide={deckWith(bad).slides[0]}
            index={0}
            total={1}
            animate={false}
          />,
        ),
      ).not.toThrow();
      expect(screen.getByText(/why carts are abandoned/i)).toBeInTheDocument();
      expect(screen.getByText(/checkout study/i)).toBeInTheDocument();
    }
  });
});
