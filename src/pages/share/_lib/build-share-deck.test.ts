import { describe, expect, it } from "vitest";
import { buildShareDeck } from "./build-share-deck";

const reels = [
  {
    id: "r1",
    title: "Cart drop-off",
    track: "Checkout",
    scenes: [
      { type: "hook", text: "Why do people abandon the cart?" },
      { type: "quote", text: "I lost trust at the payment step", by: "P03" },
      { type: "stat", num: "42%", label: "drop at payment" },
      { type: "cta", text: "Payment friction kills checkout." },
    ],
  },
  {
    id: "r2",
    title: "Shipping surprise",
    track: "Checkout",
    scenes: [
      { type: "quote", text: "The fee showed up too late", by: "P11" },
      { type: "cta", text: "Show shipping earlier." },
    ],
  },
];

describe("buildShareDeck", () => {
  it("builds title, summary, finding, and closing slides from selected scenes", () => {
    const deck = buildShareDeck({ studyTitle: "Checkout study", reels });
    expect(deck.scopeLabel).toBe("Checkout study");
    expect(deck.slides[0]).toMatchObject({ type: "title", headline: "Checkout study" });
    expect(deck.slides.at(-1)?.type).toBe("closing");
    expect(deck.slides.some((s) => s.type === "summary")).toBe(true);
    const finding = deck.slides.find((s) => s.type === "finding" && s.reelTitle === "Cart drop-off");
    expect(finding?.quotes?.[0]).toEqual({ text: "I lost trust at the payment step", by: "P03" });
    expect(finding?.stats?.[0]).toEqual({ num: "42%", label: "drop at payment" });
    expect(deck.reels.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("scopes the deck to the subset the viewer picked", () => {
    const deck = buildShareDeck({ studyTitle: "Checkout study", reels: [reels[1]] });
    expect(deck.reels).toHaveLength(1);
    expect(deck.slides.filter((s) => s.type === "finding")).toHaveLength(1);
    expect(deck.slides.find((s) => s.type === "finding")?.reelTitle).toBe("Shipping surprise");
  });
});
