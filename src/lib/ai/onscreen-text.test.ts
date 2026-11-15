import { describe, expect, it } from "vitest";
import {
  NO_ONSCREEN_TEXT,
  forbidsOnscreenText,
  withNoOnscreenText,
} from "./onscreen-text.ts";

describe("onscreen text prohibition", () => {
  it("names every kind of type the overlay would otherwise stack on", () => {
    expect(forbidsOnscreenText(NO_ONSCREEN_TEXT)).toBe(true);
  });

  it("puts the prohibition first and last around a visual prompt", () => {
    const wrapped = withNoOnscreenText("a kitchen at dusk");
    expect(wrapped.startsWith("Absolutely no on-screen text")).toBe(true);
    expect(wrapped.endsWith("readable screens.")).toBe(true);
    expect(wrapped).toContain("a kitchen at dusk");
  });
});
