import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireStudy } from "../lib/access";
import { enforceLimit } from "../lib/rateLimit";
import { assignFootage } from "../lib/footageLibrary";
import { queueNewStudy, releaseArt } from "../art";
import { buildSourceIndex, verifyScenes } from "../lib/verify";
import { CHUNK_CHARS, MAX_COMPOSE_FINDINGS } from "./ai";
import { findingTypeValidator, sceneValidator } from "../schema/validators";

export const LEASE_MS = 8 * 60_000;
const MAX_ATTEMPTS = 3;
const MAX_LOG = 200;
export const MAX_SOURCES_CHARS = 2_000_000;

type LogLevel = "info" | "warn" | "error";

function logEntry(level: LogLevel, message: string) {
  return { at: new Date().toISOString(), level, message };
}

function appendLog(
  job: Doc<"generationJobs">,
  level: LogLevel,
  message: string,
): Doc<"generationJobs">["log"] {
  return [...job.log, logEntry(level, message)].slice(-MAX_LOG);
}

async function latestJob(
  ctx: QueryCtx | MutationCtx,
  studyId: Id<"studies">,
): Promise<Doc<"generationJobs"> | null> {
  return await ctx.db
    .query("generationJobs")
    .withIndex("by_study", (q) => q.eq("studyId", studyId))
    .order("desc")
    .first();
}

// ---------- Public API ----------

export const startGeneration = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<Id<"generationJobs">> => {
    const { user, study } = await requireStudy(ctx, studyId, "editor");
    const existing = await latestJob(ctx, studyId);
    if (existing && (existing.status === "queued" || existing.status === "running")) {
      return existing._id;
    }
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(100);
    if (sources.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Add at least one source file before generating",
      });
    }
    const total = sources.reduce((n, s) => n + s.chars, 0);
    if (total > MAX_SOURCES_CHARS) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sources are too large (2 million characters max). Remove a file and try again.",
      });
    }
    await enforceLimit(ctx, "generate", study.workspaceId);
    const chunks: Doc<"generationJobs">["chunks"] = [];
    for (const s of sources) {
      for (let start = 0; start < s.text.length; start += CHUNK_CHARS) {
        chunks.push({
          sourceId: s._id,
          name: s.name,
          start,
          end: Math.min(s.text.length, start + CHUNK_CHARS),
        });
      }
    }
    const jobId = await ctx.db.insert("generationJobs", {
      studyId,
      workspaceId: study.workspaceId,
      status: "queued",
      phase: "extract",
      cursor: 0,
      chunks,
      attempts: 0,
      log: [
        logEntry(
          "info",
          `Queued: ${sources.length} source${sources.length === 1 ? "" : "s"}, ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} to read`,
        ),
      ],
      lockedUntil: new Date(0).toISOString(),
      startedBy: user._id,
    });
    await ctx.db.patch("studies", studyId, { status: "generating", lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.generation.worker.step, { jobId });
    return jobId;
  },
});

/** Restarts a failed job from the step that failed, keeping files already read. */
export const resumeGeneration = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<Id<"generationJobs">> => {
    const { study } = await requireStudy(ctx, studyId, "editor");
    const job = await latestJob(ctx, studyId);
    if (!job || job.status !== "failed") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "There's no stopped run to resume" });
    }
    await enforceLimit(ctx, "generate", study.workspaceId);
    await ctx.db.patch("generationJobs", job._id, {
      status: "queued",
      attempts: 0,
      error: undefined,
      errorDetail: undefined,
      lockedUntil: new Date(0).toISOString(),
      log: appendLog(job, "info", `Resuming from ${PHASE_LABEL[job.phase]}`),
    });
    await ctx.db.patch("studies", studyId, { status: "generating", lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.generation.worker.step, { jobId: job._id });
    return job._id;
  },
});

export const cancelGeneration = mutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    await requireStudy(ctx, studyId, "editor");
    const job = await latestJob(ctx, studyId);
    if (!job || (job.status !== "queued" && job.status !== "running")) return null;
    await ctx.db.patch("generationJobs", job._id, {
      status: "cancelled",
      log: appendLog(job, "warn", "Stopped by user"),
    });
    const reel = await ctx.db
      .query("reels")
      .withIndex("by_study_and_position", (q) => q.eq("studyId", studyId))
      .first();
    await ctx.db.patch("studies", studyId, { status: reel ? "review" : "draft" });
    return null;
  },
});

export const latestForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }) => {
    await requireStudy(ctx, studyId, "editor");
    const job = await latestJob(ctx, studyId);
    if (!job) return null;
    return {
      _id: job._id,
      status: job.status,
      phase: job.phase,
      cursor: job.cursor,
      totalChunks: job.chunks.length,
      log: job.log,
      error: job.error,
      _creationTime: job._creationTime,
    };
  },
});

// ---------- Worker internals ----------

export type ClaimResult =
  | { kind: "none" }
  | {
      kind: "extract";
      lease: string;
      chunkIndex: number;
      total: number;
      fileName: string;
      text: string;
      study: { title: string; audience: string; goal?: string };
    }
  | {
      kind: "compose";
      lease: string;
      study: { title: string; audience: string; goal?: string };
      findings: Array<{
        id: Id<"findings">;
        type: string;
        text: string;
        speaker?: string;
        number?: string;
        label?: string;
        strength: number;
        file: string;
      }>;
    }
  | { kind: "verify"; lease: string };

/** Claims the job with a lease so only one worker step runs at a time. */
export const claim = internalMutation({
  args: { jobId: v.id("generationJobs") },
  handler: async (ctx, { jobId }): Promise<ClaimResult> => {
    const job = await ctx.db.get("generationJobs", jobId);
    if (!job || (job.status !== "queued" && job.status !== "running")) {
      return { kind: "none" };
    }
    const now = new Date();
    if (job.lockedUntil > now.toISOString()) return { kind: "none" };
    const study = await ctx.db.get("studies", job.studyId);
    if (!study) {
      await ctx.db.patch("generationJobs", jobId, { status: "failed", error: "Study was deleted" });
      return { kind: "none" };
    }
    const lease = new Date(now.getTime() + LEASE_MS).toISOString();
    await ctx.db.patch("generationJobs", jobId, { status: "running", lockedUntil: lease });
    // Watchdog: if this step crashes without releasing, re-kick after the lease.
    await ctx.scheduler.runAfter(LEASE_MS + 5_000, internal.generation.worker.step, { jobId });
    const studyInfo = { title: study.title, audience: study.audience, goal: study.goal };

    if (job.phase === "extract") {
      const chunk = job.chunks[job.cursor];
      const source = chunk ? await ctx.db.get("sources", chunk.sourceId) : null;
      if (!chunk || !source) {
        // Source removed mid-run: skip this chunk.
        await ctx.db.patch("generationJobs", jobId, {
          cursor: job.cursor + 1,
          phase: job.cursor + 1 >= job.chunks.length ? "compose" : "extract",
          lockedUntil: now.toISOString(),
          log: appendLog(job, "warn", "Skipped a source that no longer exists"),
        });
        await ctx.scheduler.runAfter(0, internal.generation.worker.step, { jobId });
        return { kind: "none" };
      }
      return {
        kind: "extract",
        lease,
        chunkIndex: job.cursor,
        total: job.chunks.length,
        fileName: chunk.name,
        text: source.text.slice(chunk.start, chunk.end),
        study: studyInfo,
      };
    }
    if (job.phase === "compose") {
      const all = await ctx.db
        .query("findings")
        .withIndex("by_study_and_chunk", (q) =>
          q.eq("studyId", job.studyId).gte("chunkIndex", 0).lt("chunkIndex", job.chunks.length),
        )
        .take(4000);
      const names = new Map(job.chunks.map((c) => [c.sourceId, c.name]));
      const top = [...all]
        .sort((a, b) => b.strength - a.strength)
        .slice(0, MAX_COMPOSE_FINDINGS);
      return {
        kind: "compose",
        lease,
        study: studyInfo,
        findings: top.map((f) => ({
          id: f._id,
          type: f.type,
          text: f.text,
          speaker: f.speaker,
          number: f.number,
          label: f.label,
          strength: f.strength,
          file: names.get(f.sourceId) ?? "source",
        })),
      };
    }
    if (job.phase === "verify") return { kind: "verify", lease };
    return { kind: "none" };
  },
});

async function loadLeasedJob(
  ctx: MutationCtx,
  jobId: Id<"generationJobs">,
  lease: string,
): Promise<Doc<"generationJobs"> | null> {
  const job = await ctx.db.get("generationJobs", jobId);
  // A cancelled job or a stolen lease means this step's result is discarded.
  if (!job || job.status !== "running" || job.lockedUntil !== lease) return null;
  return job;
}

export const saveFindings = internalMutation({
  args: {
    jobId: v.id("generationJobs"),
    lease: v.string(),
    chunkIndex: v.number(),
    findings: v.array(
      v.object({
        type: findingTypeValidator,
        text: v.string(),
        speaker: v.optional(v.string()),
        number: v.optional(v.string()),
        label: v.optional(v.string()),
        strength: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const job = await loadLeasedJob(ctx, args.jobId, args.lease);
    if (!job || job.phase !== "extract" || job.cursor !== args.chunkIndex) return false;
    const chunk = job.chunks[args.chunkIndex];
    // Idempotent: replace any findings a previous attempt saved for this chunk.
    const old = await ctx.db
      .query("findings")
      .withIndex("by_study_and_chunk", (q) =>
        q.eq("studyId", job.studyId).eq("chunkIndex", args.chunkIndex),
      )
      .take(500);
    for (const f of old) await ctx.db.delete("findings", f._id);
    for (const f of args.findings) {
      await ctx.db.insert("findings", {
        ...f,
        studyId: job.studyId,
        sourceId: chunk.sourceId,
        chunkIndex: args.chunkIndex,
        strength: Math.min(3, Math.max(1, Math.round(f.strength))),
      });
    }
    const next = job.cursor + 1;
    await ctx.db.patch("generationJobs", job._id, {
      cursor: next,
      phase: next >= job.chunks.length ? "compose" : "extract",
      attempts: 0,
      lockedUntil: new Date().toISOString(),
      log: appendLog(
        job,
        "info",
        `Read ${chunk.name}${job.chunks.length > 1 ? ` (part ${args.chunkIndex + 1} of ${job.chunks.length})` : ""}: ${args.findings.length} findings`,
      ),
    });
    return true;
  },
});

export const saveReels = internalMutation({
  args: {
    jobId: v.id("generationJobs"),
    lease: v.string(),
    tracks: v.array(v.string()),
    reels: v.array(
      v.object({
        track: v.string(),
        title: v.string(),
        scenes: v.array(sceneValidator),
        findingIds: v.array(v.id("findings")),
        sourceNames: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const job = await loadLeasedJob(ctx, args.jobId, args.lease);
    if (!job || job.phase !== "compose") return false;
    // Idempotent: replace any reels from a previous compose attempt.
    const old = await ctx.db
      .query("reels")
      .withIndex("by_study_and_position", (q) => q.eq("studyId", job.studyId))
      .take(500);
    for (const r of old) {
      await releaseArt(ctx, r);
      await ctx.db.delete("reels", r._id);
    }
    const trackIndex = new Map(args.tracks.map((t, i) => [t, i]));
    const footage = assignFootage(args.reels);
    for (const [i, reel] of args.reels.entries()) {
      await ctx.db.insert("reels", {
        ...reel,
        studyId: job.studyId,
        workspaceId: job.workspaceId,
        position: i,
        trackIndex: trackIndex.get(reel.track) ?? 0,
        warning: null,
        enabled: true,
        footage: footage[i],
      });
    }
    await ctx.db.patch("studies", job.studyId, { tracks: args.tracks });
    await ctx.db.patch("generationJobs", job._id, {
      phase: "verify",
      attempts: 0,
      lockedUntil: new Date().toISOString(),
      log: appendLog(
        job,
        "info",
        `Composed ${args.reels.length} reels in ${args.tracks.length} tracks`,
      ),
    });
    return true;
  },
});

export async function studySourceIndex(ctx: MutationCtx, studyId: Id<"studies">) {
  const sources = await ctx.db
    .query("sources")
    .withIndex("by_study", (q) => q.eq("studyId", studyId))
    .take(100);
  return buildSourceIndex(sources.map((s) => s.text).join("\n\n"));
}

export const verify = internalMutation({
  args: { jobId: v.id("generationJobs"), lease: v.string() },
  handler: async (ctx, args) => {
    const job = await loadLeasedJob(ctx, args.jobId, args.lease);
    if (!job || job.phase !== "verify") return false;
    const index = await studySourceIndex(ctx, job.studyId);
    const reels = await ctx.db
      .query("reels")
      .withIndex("by_study_and_position", (q) => q.eq("studyId", job.studyId))
      .take(500);
    let flagged = 0;
    for (const reel of reels) {
      const warning = verifyScenes(reel.scenes, index);
      if (warning) flagged++;
      // Flagged reels start excluded so nothing unverified ships by default.
      await ctx.db.patch("reels", reel._id, { warning, enabled: warning === null });
    }
    await ctx.db.patch("generationJobs", job._id, {
      phase: "done",
      status: "done",
      lockedUntil: new Date().toISOString(),
      log: appendLog(
        job,
        flagged ? "warn" : "info",
        flagged
          ? `Verified: ${flagged} reel${flagged === 1 ? "" : "s"} flagged and excluded for review`
          : `Verified: all ${reels.length} reels match the sources`,
      ),
    });
    await ctx.db.patch("studies", job.studyId, { status: "review" });
    // Stock clips are placeholders; Claude now art-directs a scene for each reel in the background.
    await queueNewStudy(ctx, job.studyId, job.workspaceId);
    return true;
  },
});

/** Records a failed step; retries with backoff up to MAX_ATTEMPTS, then fails the job. */
export const recordFailure = internalMutation({
  args: {
    jobId: v.id("generationJobs"),
    lease: v.string(),
    message: v.string(),
    detail: v.string(),
    retryable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const job = await loadLeasedJob(ctx, args.jobId, args.lease);
    if (!job) return null;
    const attempts = job.attempts + 1;
    // Problems a retry can't fix (bad setup, file too long) fail straight away.
    if (!args.retryable || attempts >= MAX_ATTEMPTS) {
      const where = PHASE_LABEL[job.phase];
      const tries = args.retryable ? ` after ${attempts} tries` : "";
      const error = `${args.message} Stopped while ${where}${tries}.`;
      await ctx.db.patch("generationJobs", job._id, {
        status: "failed",
        attempts,
        error,
        errorDetail: args.detail,
        lockedUntil: new Date().toISOString(),
        log: appendLog(job, "error", error),
      });
      const reel = await ctx.db
        .query("reels")
        .withIndex("by_study_and_position", (q) => q.eq("studyId", job.studyId))
        .first();
      await ctx.db.patch("studies", job.studyId, {
        status: reel ? "review" : "draft",
        lastError: error,
      });
      return null;
    }
    const delay = 5_000 * 2 ** (attempts - 1);
    await ctx.db.patch("generationJobs", job._id, {
      attempts,
      lockedUntil: new Date().toISOString(),
      log: appendLog(
        job,
        "warn",
        `${args.message} Trying again in ${delay / 1000}s (attempt ${attempts + 1} of ${MAX_ATTEMPTS})…`,
      ),
    });
    await ctx.scheduler.runAfter(delay, internal.generation.worker.step, { jobId: job._id });
    return null;
  },
});

const PHASE_LABEL: Record<Doc<"generationJobs">["phase"], string> = {
  extract: "reading your files",
  compose: "writing reels",
  verify: "checking quotes and numbers",
  done: "finishing up",
};
