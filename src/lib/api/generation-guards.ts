export const MAX_GENERATION_STEPS = 80;
export const STALE_JOB_MS = 3 * 60 * 1000;
export const COMPOSE_BATCH_SIZE = 8;
export const MAX_COMPOSE_REELS = 24;
export const AI_CALL_TIMEOUT_MS = 90_000;
export const STALE_JOB_FAIL_MESSAGE = "Generation stalled and was stopped.";
export const PROCESS_MAX_DURATION_MS = 300_000;
export const PROCESS_DISPATCH_RESERVE_MS = 20_000;
export const PROCESS_LOCK_MS = 2 * 60 * 1000;
export const DISPATCH_RETRY_ATTEMPTS = 3;

export type StaleJobDecision = "ok" | "retrigger" | "fail";

export function wouldExceedGenerationSteps(
  attempts: number | null | undefined,
  max = MAX_GENERATION_STEPS,
): boolean {
  return (attempts ?? 0) >= max;
}

export function nextAttemptCount(attempts: number | null | undefined): number {
  return (attempts ?? 0) + 1;
}

/** Skip further compose calls when this job already hit the reel cap. */
export function shouldSkipComposeInsert(existingReelCount: number | null | undefined): boolean {
  return (existingReelCount ?? 0) >= MAX_COMPOSE_REELS;
}

export function shouldFinishCompose(args: {
  existingCount: number;
  savedThisBatch: number;
  batchSize?: number;
  maxReels?: number;
}): boolean {
  const batch = args.batchSize ?? COMPOSE_BATCH_SIZE;
  const max = args.maxReels ?? MAX_COMPOSE_REELS;
  const total = args.existingCount + args.savedThisBatch;
  if (total >= max) return true;
  if (args.savedThisBatch === 0 && args.existingCount > 0) return true;
  if (args.savedThisBatch > 0 && args.savedThisBatch < batch) return true;
  return false;
}

export function isStaleRunningJob(
  job: { status: string; updated_at: string },
  now = Date.now(),
  maxAge = STALE_JOB_MS,
): boolean {
  if (job.status !== "running" && job.status !== "queued") return false;
  const updated = Date.parse(job.updated_at);
  if (Number.isNaN(updated)) return true;
  return now - updated > maxAge;
}

export function staleJobDecision(
  job: { status: string; updated_at: string; attempts?: number | null },
  now = Date.now(),
): StaleJobDecision {
  if (!isStaleRunningJob(job, now)) return "ok";
  if (wouldExceedGenerationSteps(job.attempts)) return "fail";
  return "retrigger";
}

export function isTerminalJobStatus(status: string | null | undefined): boolean {
  return status === "done" || status === "cancelled" || status === "failed";
}

export function canRunAnotherStep(args: {
  startedAt: number;
  now?: number;
  minStepMs?: number;
  maxDurationMs?: number;
  reserveMs?: number;
}): boolean {
  const now = args.now ?? Date.now();
  const minStep = args.minStepMs ?? AI_CALL_TIMEOUT_MS + 15_000;
  const max = args.maxDurationMs ?? PROCESS_MAX_DURATION_MS;
  const reserve = args.reserveMs ?? PROCESS_DISPATCH_RESERVE_MS;
  return now + minStep + reserve < args.startedAt + max;
}

/** Best-effort restore when generation fails or is cancelled. */
export function previousStudyStatus(args: {
  publishedAt?: string | null;
  reelCount?: number | null;
}): "draft" | "review" | "published" {
  if (args.publishedAt) return "published";
  if ((args.reelCount ?? 0) > 0) return "review";
  return "draft";
}
