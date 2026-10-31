export class StepError extends Error {
  constructor(
    message: string,
    public readonly detail: { detail: string; retryable: boolean; cause?: unknown }
  ) {
    super(message);
    this.name = 'StepError';
  }

  get retryable(): boolean {
    return this.detail.retryable;
  }
}

export function aiHttpError(status: number, message: string): StepError {
  const isRetryable = status === 429 || status === 500 || status === 503 || status === 504;
  return new StepError(
    status === 429
      ? 'Too many AI requests right now. Retrying in a moment.'
      : status === 401
        ? 'AI service authentication failed.'
        : status === 500 || status === 503
          ? 'The AI service is temporarily unavailable.'
          : 'The AI service returned an error.',
    {
      detail: `HTTP ${status}: ${message}`,
      retryable: isRetryable,
    }
  );
}

export function toStepError(err: unknown): StepError {
  if (err instanceof StepError) return err;
  return new StepError(
    'An unexpected error occurred.',
    {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    }
  );
}
