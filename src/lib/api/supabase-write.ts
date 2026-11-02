import { StepError } from "../errors/step-error.js";

export function throwIfWriteError(
  error: { message: string } | null | undefined,
  context: string,
): void {
  if (!error) return;
  throw new StepError(`Couldn't save ${context}.`, {
    detail: error.message,
    retryable: false,
  });
}
