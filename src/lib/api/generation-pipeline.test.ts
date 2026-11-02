import { describe, expect, it } from "vitest";
import { StepError } from "../errors/step-error";
import { composeSchema, coerceSceneType } from "../ai/prompts";
import { toScene } from "../ai/scenes";
import { imageGenerateParams, imageQuality, pngBlobFromB64, shouldRetryToolCall } from "../ai/client";
import {
  MAX_GENERATION_STEPS,
  shouldSkipComposeInsert,
  wouldExceedGenerationSteps,
} from "./generation-guards";
import { throwIfWriteError } from "./supabase-write";

describe("generation pipeline guards", () => {
  it("fails the job after too many process steps", () => {
    expect(wouldExceedGenerationSteps(0)).toBe(false);
    expect(wouldExceedGenerationSteps(MAX_GENERATION_STEPS - 1)).toBe(false);
    expect(wouldExceedGenerationSteps(MAX_GENERATION_STEPS)).toBe(true);
    expect(wouldExceedGenerationSteps(MAX_GENERATION_STEPS + 3)).toBe(true);
  });

  it("skips compose insert when reels for this job already exist", () => {
    expect(shouldSkipComposeInsert(0)).toBe(false);
    expect(shouldSkipComposeInsert(null)).toBe(false);
    expect(shouldSkipComposeInsert(12)).toBe(true);
  });

  it("throws on a failed Supabase write so the job can be marked failed", () => {
    expect(() => throwIfWriteError(null, "reels")).not.toThrow();
    expect(() => throwIfWriteError({ message: "generation_jobs_phase_check" }, "generation job")).toThrow(
      StepError,
    );
    try {
      throwIfWriteError({ message: "generation_jobs_phase_check" }, "generation job");
    } catch (error) {
      expect(error).toBeInstanceOf(StepError);
      expect((error as StepError).detail.detail).toContain("generation_jobs_phase_check");
    }
  });
});

describe("compose scene validation", () => {
  it("coerces unknown scene types to line instead of failing the whole compose", () => {
    expect(coerceSceneType("title")).toBe("line");
    expect(coerceSceneType("hook")).toBe("hook");

    const parsed = composeSchema.safeParse({
      tracks: ["A"],
      reels: [
        {
          track: "A",
          title: "Dinner is chaos",
          findingIds: ["f1"],
          scenes: [
            { type: "hook", text: "Weeknights fall apart" },
            { type: "headline", text: "People skip the sauce" },
            { type: "cta", text: "Fix the weeknight" },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.reels[0]?.scenes[1]?.type).toBe("line");
    expect(toScene({ type: coerceSceneType("headline"), text: "People skip the sauce" })).toEqual({
      type: "line",
      text: "People skip the sauce",
    });
  });

  it("retries once on invalid scene-type model output", () => {
    const err = new StepError("The AI sent back an answer in the wrong format.", {
      detail: "invalid_value at reels[0].scenes[1].type, expected hook|line|list|stat|quote|cta",
      retryable: true,
    });
    expect(shouldRetryToolCall(err)).toBe(true);
  });
});

describe("gpt-image-1 request", () => {
  it("omits response_format and uses medium quality by default", () => {
    expect(imageQuality(undefined)).toBe("medium");
    expect(imageQuality("standard")).toBe("medium");
    expect(imageQuality("high")).toBe("high");
    const params = imageGenerateParams("a kitchen at dusk");
    expect(params).not.toHaveProperty("response_format");
    expect(params.quality).toBe("medium");
    expect(params.model).toBe(process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  });

  it("builds a PNG blob from b64_json output", async () => {
    const blob = pngBlobFromB64("AQID");
    expect(blob.type).toBe("image/png");
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]));
  });
});
