/**
 * A generation step failure with a plain-language message for editors,
 * the technical detail for troubleshooting, and whether retrying could help.
 */
export class StepError extends Error {
  readonly detail: string;
  readonly retryable: boolean;
  readonly original: unknown;

  constructor(message: string, opts: { detail?: string; retryable: boolean; cause?: unknown }) {
    super(message);
    this.name = "StepError";
    this.detail = (opts.detail ?? message).slice(0, 500);
    this.retryable = opts.retryable;
    this.original = opts.cause;
  }
}

/** Maps an AI gateway HTTP failure to a StepError. */
export function aiHttpError(status: number, detail: string): StepError {
  const full = `AI service error (${status}): ${detail}`;
  if (status === 429) {
    return new StepError("The AI service is busy right now.", { detail: full, retryable: true });
  }
  if (status >= 500) {
    return new StepError("The AI service had a temporary problem.", { detail: full, retryable: true });
  }
  if (status === 401 || status === 403) {
    return new StepError("AI isn't set up correctly for this app.", { detail: full, retryable: false });
  }
  if (status === 413 || /context|too long|maximum.*tokens|prompt is too long/i.test(detail)) {
    return new StepError("One of your files is too long for the AI to read in one go.", { detail: full, retryable: false });
  }
  return new StepError("The AI couldn't process this request.", { detail: full, retryable: false });
}

/** Normalizes any thrown value into a StepError (unknown errors are worth one more try). */
export function toStepError(err: unknown): StepError {
  if (err instanceof StepError) return err;
  const detail = err instanceof Error ? err.message : String(err);
  return new StepError("Something unexpected went wrong.", { detail, retryable: true, cause: err });
}
