import { describe, expect, it, vi } from "vitest";
import {
  countSuccessfulHttp,
  isRetryableHttpStatus,
  mapWithConcurrency,
  retryDelayMs,
  retryWithBackoff,
  RetryableHttpError,
} from "./async-jobs";

describe("async job helpers", () => {
  it("treats only HTTP 2xx as success, not a fulfilled 400/500", () => {
    const results: PromiseSettledResult<{ ok: boolean; status: number }>[] = [
      { status: "fulfilled", value: { ok: true, status: 200 } },
      { status: "fulfilled", value: { ok: false, status: 400 } },
      { status: "fulfilled", value: { ok: false, status: 500 } },
      { status: "rejected", reason: new Error("network") },
    ];
    expect(countSuccessfulHttp(results)).toBe(1);
  });

  it("retries 429 and 5xx with backoff, including Retry-After", async () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(retryDelayMs(0, "2")).toBe(2000);
    expect(retryDelayMs(3)).toBe(8000);

    const sleep = vi.fn(async () => undefined);
    let calls = 0;
    const value = await retryWithBackoff(
      async () => {
        calls += 1;
        if (calls < 3) throw new RetryableHttpError(429, "slow down", "0");
        return "ok";
      },
      { sleep },
    );
    expect(value).toBe("ok");
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent failures", async () => {
    await expect(
      retryWithBackoff(async () => {
        throw new RetryableHttpError(400, "bad prompt");
      }),
    ).rejects.toMatchObject({ status: 400, retryable: false });
  });

  it("limits concurrency instead of firing every job at once", async () => {
    let inflight = 0;
    let max = 0;
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (item) => {
      inflight += 1;
      max = Math.max(max, inflight);
      await Promise.resolve();
      inflight -= 1;
      return item * 2;
    });
    expect(max).toBeLessThanOrEqual(2);
    expect(
      results.map((r) => (r.status === "fulfilled" ? r.value : 0)),
    ).toEqual([2, 4, 6, 8, 10]);
  });
});
