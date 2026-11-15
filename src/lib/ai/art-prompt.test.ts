import { describe, expect, it } from "vitest";
import { ART_SYSTEM, artUserPrompt, imagePrompt } from "./art-prompt.ts";
import { forbidsOnscreenText } from "./onscreen-text.ts";

describe("art prompts", () => {
  it("tells the art director the plate must not carry the message", () => {
    expect(ART_SYSTEM).toMatch(/never carries the message/);
    expect(forbidsOnscreenText(ART_SYSTEM)).toBe(true);
    expect(ART_SYSTEM).toMatch(/Do not quote the reel script/);
  });

  it("wraps the image-model prompt so captions cannot be baked in", () => {
    const prompt = imagePrompt("a half-used onion on a cutting board");
    expect(forbidsOnscreenText(prompt)).toBe(true);
    expect(prompt).toMatch(/Clean plate/);
    expect(prompt).toContain("a half-used onion on a cutting board");
  });

  it("marks the reel script as subject matter, not on-image copy", () => {
    const user = artUserPrompt({
      studyTitle: "Supperly",
      track: "At home",
      title: "Help that became homework",
      scenes: [{ type: "hook", text: "When does a meal kit stop *helping*?" }],
    });
    expect(user).toMatch(/never paint these words/);
    expect(user).toContain("When does a meal kit stop helping?");
  });
});
