import { describe, expect, it } from "vitest";
import { IMAGE_FALLBACK_MODEL, IMAGE_MODEL, TEXT_MODEL } from "./client";

describe("OpenAI model defaults", () => {
  it("defaults text to gpt-5.1 and images to gpt-image-1", () => {
    expect(TEXT_MODEL).toBe(process.env.OPENAI_TEXT_MODEL || "gpt-5.1");
    expect(IMAGE_MODEL).toBe(process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
    if (!process.env.OPENAI_IMAGE_MODEL) {
      expect(IMAGE_MODEL).toBe("gpt-image-1");
    }
    if (!process.env.OPENAI_TEXT_MODEL) {
      expect(TEXT_MODEL).toBe("gpt-5.1");
    }
    expect(IMAGE_FALLBACK_MODEL).toBe("dall-e-3");
  });
});
