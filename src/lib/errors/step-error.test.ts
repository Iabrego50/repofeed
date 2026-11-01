import { describe, expect, it } from "vitest";
import { StepError, aiHttpError, toStepError } from "./step-error";

describe("aiHttpError", () => {
  it("retries temporary AI problems", () => {
    expect(aiHttpError(429, "rate limited").retryable).toBe(true);
    expect(aiHttpError(503, "overloaded").retryable).toBe(true);
  });

  it("fails fast on problems a retry can't fix", () => {
    expect(aiHttpError(401, "bad key").retryable).toBe(false);
    expect(aiHttpError(400, "prompt is too long: 250000 tokens").message).toMatch(/too long/);
    expect(aiHttpError(400, 'tool_choice: type "tool" is not supported').retryable).toBe(false);
  });

  it("keeps the technical detail out of the friendly message", () => {
    const e = aiHttpError(500, "upstream exploded");
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
