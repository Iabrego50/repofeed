import { describe, expect, it } from "vitest";
import { reelTracks, sceneText, searchReels, type SearchableReel } from "./search.ts";

const reels: SearchableReel[] = [
  {
    _id: "a",
    title: "Busy parents skip dinner",
    track: "Habits",
    studyTitle: "Meal kits",
    scenes: [{ type: "hook", text: "Weeknights are *chaos*" }, { type: "stat", num: "62%", label: "cook under 20 minutes" }],
  },
  {
    _id: "b",
    title: "Price shock at checkout",
    track: "Pricing",
    studyTitle: "Meal kits",
    scenes: [{ type: "quote", text: "I thought dinner was included", by: "P07" }],
  },
  {
    _id: "c",
    title: "Onboarding drop-off",
    track: "Habits",
    studyTitle: "Banking app",
    scenes: [{ type: "list", title: "Why they quit", items: ["Too many forms", "ID upload failed"] }],
  },
];

describe("searchReels", () => {
  it("returns nothing for an empty query without a category", () => {
    expect(searchReels(reels, "   ")).toEqual([]);
  });

  it("matches scene text and study names, ranking title matches first", () => {
    const ids = searchReels(reels, "dinner").map((h) => h.reel._id);
    expect(ids).toEqual(["a", "b"]);
    expect(searchReels(reels, "banking").map((h) => h.reel._id)).toEqual(["c"]);
  });

  it("requires every word to match, case-insensitively", () => {
    expect(searchReels(reels, "MEAL price").map((h) => h.reel._id)).toEqual(["b"]);
    expect(searchReels(reels, "meal banking")).toEqual([]);
  });

  it("shows a snippet only when the match comes from scene text", () => {
    expect(searchReels(reels, "parents")[0].snippet).toBeNull();
    expect(searchReels(reels, "upload")[0].snippet).toContain("ID upload failed");
  });

  it("narrows to one category, listing all of it when the query is empty", () => {
    expect(searchReels(reels, "", "Habits").map((h) => h.reel._id)).toEqual(["a", "c"]);
    expect(searchReels(reels, "dinner", "Pricing").map((h) => h.reel._id)).toEqual(["b"]);
  });
});

describe("helpers", () => {
  it("strips emphasis markers from scene text", () => {
    expect(sceneText(reels[0].scenes)).toBe("Weeknights are chaos 62% cook under 20 minutes");
  });

  it("lists distinct categories in order", () => {
    expect(reelTracks(reels)).toEqual(["Habits", "Pricing"]);
  });
});
