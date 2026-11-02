export const MAX_GENERATION_STEPS = 80;

export function wouldExceedGenerationSteps(
  attempts: number | null | undefined,
  max = MAX_GENERATION_STEPS,
): boolean {
  return (attempts ?? 0) >= max;
}

export function nextAttemptCount(attempts: number | null | undefined): number {
  return (attempts ?? 0) + 1;
}

/** Skip compose insert when this job already created reels (resume / retry). */
export function shouldSkipComposeInsert(existingReelCount: number | null | undefined): boolean {
  return (existingReelCount ?? 0) > 0;
}
