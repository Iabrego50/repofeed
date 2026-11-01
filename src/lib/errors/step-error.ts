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
  
  let friendlyMessage = 'The AI service returned an error.';
  if (status === 429) {
    friendlyMessage = 'Too many AI requests right now. Retrying in a moment.';
  } else if (status === 401) {
    friendlyMessage = 'AI service authentication failed.';
  } else if (status === 500 || status === 503) {
    friendlyMessage = 'The AI service is temporarily unavailable.';
  } else if (status === 400 && message.includes('too long')) {
    friendlyMessage = 'Your prompt is too long for the AI service.';
  }
  
  return new StepError(friendlyMessage, {
    detail: `HTTP ${status}: ${message}`,
    retryable: isRetryable,
  });
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
