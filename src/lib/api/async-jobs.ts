/** Shared concurrency, retry, and HTTP-success helpers for fan-out AI jobs. */

export const DEFAULT_JOB_CONCURRENCY = 2;
export const DEFAULT_RETRY_ATTEMPTS = 4;
export const DEFAULT_RETRY_BASE_MS = 1_000;
export const DEFAULT_RETRY_MAX_MS = 30_000;

export function isRetryableHttpStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

export function retryDelayMs(
  attempt: number,
  retryAfterHeader?: string | null,
  baseMs = DEFAULT_RETRY_BASE_MS,
  maxMs = DEFAULT_RETRY_MAX_MS,
): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.round(seconds * 1000), maxMs);
    }
    const date = Date.parse(retryAfterHeader);
    if (!Number.isNaN(date)) {
      return Math.min(Math.max(0, date - Date.now()), maxMs);
    }
  }
  const exp = Math.min(baseMs * 2 ** Math.max(0, attempt), maxMs);
  return exp;
}

export function nextAttemptAtIso(
  attempt: number,
  now = Date.now(),
  retryAfterHeader?: string | null,
): string {
  return new Date(now + retryDelayMs(attempt, retryAfterHeader)).toISOString();
}

export type HttpLikeResult = { ok?: boolean; status?: number };

/** fetch() fulfills on HTTP 4xx/5xx. Only 2xx counts as success. */
export function isSuccessfulHttpResult(
  result: PromiseSettledResult<HttpLikeResult>,
): boolean {
  return result.status === "fulfilled" && result.value.ok === true;
}

export function countSuccessfulHttp(
  results: PromiseSettledResult<HttpLikeResult>[],
): number {
  return results.filter(isSuccessfulHttpResult).length;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const limit = Math.max(1, Math.floor(concurrency) || 1);
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        const value = await fn(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export class RetryableHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfter?: string;

  constructor(status: number, message: string, retryAfter?: string) {
    super(message);
    this.name = "RetryableHttpError";
    this.status = status;
    this.retryable = isRetryableHttpStatus(status);
    this.retryAfter = retryAfter;
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableHttpError) return error.retryable;
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as { retryable?: unknown }).retryable);
  }
  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
    isRetryable?: (error: unknown) => boolean;
    now?: () => number;
  } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const sleep =
    opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const retryable = opts.isRetryable ?? isRetryableError;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxAttempts - 1 && retryable(error);
      if (!canRetry) throw error;
      const retryAfter =
        error instanceof RetryableHttpError ? error.retryAfter : undefined;
      await sleep(retryDelayMs(attempt, retryAfter));
    }
  }
  throw lastError;
}
