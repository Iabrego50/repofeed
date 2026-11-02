import { describe, expect, it } from "vitest";
import { StepError, aiHttpError, toStepError } from "./step-error";

describe("aiHttpError", () => {
  it("retries temporary AI problems", () => {
    expect(aiHttpError(429, "rate limited").retryable).toBe(true);
    expect(aiHttpError(503, "overloaded").retryable).toBe(true);
  });

  it("maps insufficient_quota to 402 and keeps the real 429 reason", () => {
    const quota = aiHttpError(429, "You exceeded your current quota", "insufficient_quota");
    expect(quota.httpStatus).toBe(402);
    expect(quota.message).toBe("AI provider out of credits");
    expect(quota.retryable).toBe(false);

    const limited = aiHttpError(429, "Rate limit reached for gpt-5.1");
    expect(limited.httpStatus).toBe(429);
    expect(limited.message).toBe("Rate limit reached for gpt-5.1");
    expect(limited.retryable).toBe(true);
  });

  it("fails fast on problems a retry can't fix", () => {
    expect(aiHttpError(401, "bad key").retryable).toBe(false);
    expect(aiHttpError(400, "prompt is too long: 250000 tokens").message).toMatch(/too long/);
    expect(aiHttpError(400, 'tool_choice: type "tool" is not supported').retryable).toBe(false);
  });

  it("surfaces other provider errors as 502 without leaking the upstream text", () => {
    const e = aiHttpError(500, "upstream exploded");
    expect(e.httpStatus).toBe(502);
    expect(e.message).not.toContain("upstream");
    expect(e.detail.detail).toContain("upstream exploded");
  });
});

describe("toStepError", () => {
  it("passes StepErrors through and wraps anything else as retryable", () => {
    const original = new StepError("x", { retryable: false, detail: "test" });
    expect(toStepError(original)).toBe(original);
    const wrapped = toStepError(new Error("boom"));
    expect(wrapped.retryable).toBe(true);
    expect(wrapped.detail.detail).toBe("boom");
  });
});
