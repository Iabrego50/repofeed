import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { StepError } from "../errors/step-error";
import { composeSchema, coerceSceneType } from "../ai/prompts";
import { toScene } from "../ai/scenes";
import {
  abortAfter,
  generateImageWithModels,
  imageGenerateParams,
  imageQuality,
  isAbortError,
  isImageModelUnavailable,
  isImageParamRejected,
  pngBlobFromB64,
  shouldRetryToolCall,
} from "../ai/client";
import {
  MAX_COMPOSE_REELS,
  MAX_GENERATION_STEPS,
  STALE_JOB_MS,
  previousStudyStatus,
  shouldFinishCompose,
  shouldSkipComposeInsert,
  staleJobDecision,
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

  it("skips further compose inserts only after the reel cap", () => {
    expect(shouldSkipComposeInsert(0)).toBe(false);
    expect(shouldSkipComposeInsert(null)).toBe(false);
    expect(shouldSkipComposeInsert(12)).toBe(false);
    expect(shouldSkipComposeInsert(MAX_COMPOSE_REELS - 1)).toBe(false);
    expect(shouldSkipComposeInsert(MAX_COMPOSE_REELS)).toBe(true);
  });

  it("finishes compose on a short batch, empty follow-up, or the reel cap", () => {
    expect(shouldFinishCompose({ existingCount: 0, savedThisBatch: 8 })).toBe(false);
    expect(shouldFinishCompose({ existingCount: 8, savedThisBatch: 8 })).toBe(false);
    expect(shouldFinishCompose({ existingCount: 16, savedThisBatch: 8 })).toBe(true);
    expect(shouldFinishCompose({ existingCount: 8, savedThisBatch: 3 })).toBe(true);
    expect(shouldFinishCompose({ existingCount: 8, savedThisBatch: 0 })).toBe(true);
    expect(shouldFinishCompose({ existingCount: 0, savedThisBatch: 0 })).toBe(false);
  });

  it("restores the previous study status from published_at or existing reels", () => {
    expect(previousStudyStatus({ publishedAt: "2026-01-01T00:00:00Z", reelCount: 0 })).toBe("published");
    expect(previousStudyStatus({ publishedAt: null, reelCount: 4 })).toBe("review");
    expect(previousStudyStatus({ publishedAt: null, reelCount: 0 })).toBe("draft");
  });

  it("re-triggers stale running jobs and fails them after too many steps", () => {
    const now = Date.parse("2026-11-02T12:00:00.000Z");
    const fresh = new Date(now - STALE_JOB_MS + 1_000).toISOString();
    const stale = new Date(now - STALE_JOB_MS - 1_000).toISOString();
    expect(staleJobDecision({ status: "running", updated_at: fresh, attempts: 4 }, now)).toBe("ok");
    expect(staleJobDecision({ status: "running", updated_at: stale, attempts: 4 }, now)).toBe("retrigger");
    expect(staleJobDecision({ status: "queued", updated_at: stale, attempts: 0 }, now)).toBe("retrigger");
    expect(
      staleJobDecision({ status: "running", updated_at: stale, attempts: MAX_GENERATION_STEPS }, now),
    ).toBe("fail");
    expect(staleJobDecision({ status: "done", updated_at: stale, attempts: 4 }, now)).toBe("ok");
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
    const params = imageGenerateParams("a kitchen at dusk", "gpt-image-1");
    expect(params).not.toHaveProperty("response_format");
    expect(params).toMatchObject({ quality: "medium", model: "gpt-image-1" });
  });

  it("builds a PNG blob from b64_json output", async () => {
    const blob = pngBlobFromB64("AQID");
    expect(blob.type).toBe("image/png");
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]));
  });

  it("sends the exact request body for gpt-image-1, dall-e-3, and dall-e-2", () => {
    expect(imageGenerateParams("a kitchen at dusk", "gpt-image-1", "medium")).toEqual({
      model: "gpt-image-1",
      prompt: "a kitchen at dusk",
      size: "1024x1536",
      quality: "medium",
      n: 1,
    });
    expect(imageGenerateParams("a kitchen at dusk", "gpt-image-1", "medium")).not.toHaveProperty(
      "response_format",
    );
    expect(imageGenerateParams("a kitchen at dusk", "dall-e-3", "medium")).toEqual({
      model: "dall-e-3",
      prompt: "a kitchen at dusk",
      size: "1024x1792",
      quality: "standard",
      n: 1,
      response_format: "b64_json",
    });
    expect(imageGenerateParams("a kitchen at dusk", "dall-e-3", "high")).toEqual({
      model: "dall-e-3",
      prompt: "a kitchen at dusk",
      size: "1024x1792",
      quality: "hd",
      n: 1,
      response_format: "b64_json",
    });
    expect(imageGenerateParams("a kitchen at dusk", "dall-e-2", "high")).toEqual({
      model: "dall-e-2",
      prompt: "a kitchen at dusk",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
    });
    expect(imageGenerateParams("a kitchen at dusk", "dall-e-2")).not.toHaveProperty("quality");
  });

  it("treats model-not-found and org verification errors as unavailable image models", () => {
    expect(
      isImageModelUnavailable({
        status: 400,
        code: "model_not_found",
        message: "The model 'gpt-image-1' does not exist",
      }),
    ).toBe(true);
    expect(
      isImageModelUnavailable({
        status: 403,
        message: "Your organization must be verified to use the model",
      }),
    ).toBe(true);
    expect(isImageModelUnavailable({ status: 500, message: "upstream exploded" })).toBe(false);
  });

  it("falls back from gpt-image-1 to dall-e-3 when the model does not exist", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const generate = vi.fn(async (params: { model: string }) => {
      if (params.model === "gpt-image-1") {
        throw Object.assign(new Error("The model 'gpt-image-1' does not exist"), {
          status: 400,
          code: "model_not_found",
        });
      }
      expect(params).toEqual({
        model: "dall-e-3",
        prompt: "a kitchen",
        size: "1024x1792",
        quality: "standard",
        n: 1,
        response_format: "b64_json",
      });
      return { data: [{ b64_json: "AQID" }] };
    });
    const result = await generateImageWithModels("a kitchen", ["gpt-image-1", "dall-e-3"], generate);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0]?.[0]).toEqual(imageGenerateParams("a kitchen", "gpt-image-1"));
    expect(generate.mock.calls[1]?.[0]).toEqual(imageGenerateParams("a kitchen", "dall-e-3"));
    expect(result.model).toBe("dall-e-3");
    expect(result.blob.type).toBe("image/png");
    expect(info.mock.calls.some((call) => String(call[0]).includes("dall-e-3"))).toBe(true);
    info.mockRestore();
  });

  it("falls back to dall-e-2 when dall-e-3 rejects response_format", async () => {
    expect(
      isImageParamRejected({ status: 400, message: "Unknown parameter: 'response_format'" }),
    ).toBe(true);
    const generate = vi.fn(async (params: { model: string }) => {
      if (params.model === "gpt-image-1") {
        throw Object.assign(new Error("The model 'gpt-image-1' does not exist"), { status: 400 });
      }
      if (params.model === "dall-e-3") {
        throw Object.assign(new Error("Unknown parameter: 'response_format'"), { status: 400 });
      }
      expect(params).toEqual({
        model: "dall-e-2",
        prompt: "a kitchen",
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
      });
      return { data: [{ b64_json: "AQID" }] };
    });
    const result = await generateImageWithModels(
      "a kitchen",
      ["gpt-image-1", "dall-e-3", "dall-e-2"],
      generate,
    );
    expect(generate.mock.calls.map((call) => call[0]?.model)).toEqual([
      "gpt-image-1",
      "dall-e-3",
      "dall-e-2",
    ]);
    expect(result.model).toBe("dall-e-2");
  });
});

describe("OpenAI abort timeout", () => {
  it("maps abort errors and fires AbortController after the deadline", async () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError({ name: "APIUserAbortError" })).toBe(true);
    expect(isAbortError({ name: "APIConnectionTimeoutError" })).toBe(true);
    const abort = abortAfter(20);
    await new Promise((resolve) => abort.signal.addEventListener("abort", resolve, { once: true }));
    expect(abort.signal.aborted).toBe(true);
    abort.cancel();
  });
});

describe("process function duration", () => {
  it("sets maxDuration 300 for the process function in vercel.json", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      functions?: Record<string, { maxDuration?: number }>;
    };
    expect(vercel.functions?.["api/generation/process.ts"]?.maxDuration).toBe(300);
  });
});
