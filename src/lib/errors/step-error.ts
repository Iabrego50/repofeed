export class StepError extends Error {
  constructor(
    message: string,
    public readonly detail: {
      detail: string;
      retryable: boolean;
      cause?: unknown;
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = "StepError";
  }

  get retryable(): boolean {
    return this.detail.retryable;
  }

  get httpStatus(): number {
    return this.detail.httpStatus ?? 500;
  }
}

function isInsufficientQuota(status: number, message: string, code?: string): boolean {
  if (code === "insufficient_quota") return true;
  if (/insufficient_quota/i.test(message)) return true;
  return status === 429 && /exceeded your current quota/i.test(message);
}

export function aiHttpError(status: number, message: string, code?: string): StepError {
  if (isInsufficientQuota(status, message, code)) {
    return new StepError("AI provider out of credits", {
      detail: `HTTP ${status}: ${message}`,
      retryable: false,
      httpStatus: 402,
    });
  }

  if (status === 429) {
    return new StepError(message || "Too many AI requests right now.", {
      detail: `HTTP 429: ${message}`,
      retryable: true,
      httpStatus: 429,
    });
  }

  const isRetryable = status === 500 || status === 503 || status === 504;

  let friendlyMessage = "The AI service returned an error.";
  if (status === 401) {
    friendlyMessage = "AI service authentication failed.";
  } else if (status === 500 || status === 503) {
    friendlyMessage = "The AI service is temporarily unavailable.";
  } else if (status === 400 && message.includes("too long")) {
    friendlyMessage = "Your prompt is too long for the AI service.";
  }

  return new StepError(friendlyMessage, {
    detail: `HTTP ${status}: ${message}`,
    retryable: isRetryable,
    httpStatus: 502,
  });
}

export function mapOpenAIError(err: {
  status?: number | null;
  message: string;
  code?: string | null;
}): StepError {
  return aiHttpError(err.status || 500, err.message, err.code ?? undefined);
}

export function toStepError(err: unknown): StepError {
  if (err instanceof StepError) return err;
  return new StepError("An unexpected error occurred.", {
    detail: err instanceof Error ? err.message : String(err),
    retryable: true,
    cause: err,
  });
}
