import { describe, expect, it } from "vitest";
import { IMAGE_MODEL, TEXT_MODEL, imageModelQueue } from "./client";

describe("OpenAI model defaults", () => {
  it("defaults text to gpt-5.1 and images to gpt-image-2.5-sunburst", () => {
    expect(TEXT_MODEL).toBe(process.env.OPENAI_TEXT_MODEL || "gpt-5.1");
    expect(IMAGE_MODEL).toBe(process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst");
    if (!process.env.OPENAI_IMAGE_MODEL) {
      expect(IMAGE_MODEL).toBe("gpt-image-2.5-sunburst");
    }
    if (!process.env.OPENAI_TEXT_MODEL) {
      expect(TEXT_MODEL).toBe("gpt-5.1");
    }
    expect(imageModelQueue()).toEqual([IMAGE_MODEL]);
    expect(imageModelQueue().some((model) => model.startsWith("dall-e"))).toBe(false);
  });
});
