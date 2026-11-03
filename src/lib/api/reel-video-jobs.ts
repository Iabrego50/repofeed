import { mapWithConcurrency } from "./async-jobs.js";
import { publicObjectUrl, publicStorageOrigin } from "./storage-urls.js";
import {
  OPENAI_VIDEOS_SHUTDOWN_MESSAGE,
  type VideoProvider,
} from "../ai/videos.js";
import {
  VIDEO_BUCKET,
  VIDEO_PROCESS_BATCH,
  buildVideoPrompt,
  completedVideoState,
  countsTowardCap,
  failedVideoState,
  fallbackFootageFor,
  hasAiVideo,
  inProgressVideoState,
  isUserUpload,
  needsAiVideo,
  queuedVideoState,
  shouldPollJob,
  shouldStartJob,
  skippedVideoState,
  startingVideoState,
  studyVideoCap,
  videoAspectRatio,
  videoCaption,
  videoConcurrency,
  videoGenerationEnabled,
  videoModel,
  videoResolution,
  videoSeconds,
  videoStoragePath,
  type ReelVideo,
  type ReelVideoRow,
} from "./reel-video.js";

export type ReelVideoStore = {
  listByStudy: (studyId: string) => Promise<ReelVideoRow[]>;
  listPending: (limit: number) => Promise<ReelVideoRow[]>;
  listEligible: (args: {
    studyId?: string;
    reelId?: string;
    titleContains?: string;
    limit: number;
  }) => Promise<ReelVideoRow[]>;
  updateReel: (
    id: string,
    patch: { footage?: unknown; video?: ReelVideo; updated_at: string },
  ) => Promise<void>;
  workspacePlan: (workspaceId: string) => Promise<string | null>;
  uploadVideo: (path: string, bytes: Uint8Array) => Promise<void>;
};

export type ProcessVideoResult = {
  started: number;
  polled: number;
  completed: number;
  failed: number;
  skipped: number;
};

export type EnqueueVideoResult = {
  queued: number;
  skipped: number;
};

function nowIso(now: number): string {
  return new Date(now).toISOString();
}

function referenceImageUrl(row: ReelVideoRow): string | undefined {
  const artUrl = row.art?.status === "completed" ? row.art.url : undefined;
  const footageUrl =
    row.footage?.media === "image" ? row.footage.url : undefined;
  const url = artUrl || footageUrl;
  if (!url || url.startsWith("/")) return undefined;
  return url;
}

export async function enqueueReelVideos(
  store: ReelVideoStore,
  args: {
    studyId?: string;
    reelId?: string;
    titleContains?: string;
    limit?: number;
    env?: NodeJS.ProcessEnv;
    now?: number;
  } = {},
): Promise<EnqueueVideoResult> {
  const env = args.env ?? process.env;
  const now = args.now ?? Date.now();
  const limit = args.limit ?? 50;
  const rows = await store.listEligible({
    studyId: args.studyId,
    reelId: args.reelId,
    titleContains: args.titleContains,
    limit,
  });

  let queued = 0;
  let skipped = 0;
  const reservedByStudy = new Map<string, number>();

  for (const row of rows) {
    if (!videoGenerationEnabled(env)) {
      await store.updateReel(row.id, {
        footage: fallbackFootageFor(row),
        video: skippedVideoState("AI video generation is off", now, env),
        updated_at: nowIso(now),
      });
      skipped += 1;
      continue;
    }
    if (!needsAiVideo(row)) {
      skipped += 1;
      continue;
    }

    const studyRows = await store.listByStudy(row.study_id);
    const used =
      studyRows.filter(countsTowardCap).length +
      (reservedByStudy.get(row.study_id) ?? 0);
    const plan = await store.workspacePlan(row.workspace_id);
    const cap = studyVideoCap(plan, env);
    if (used >= cap) {
      await store.updateReel(row.id, {
        footage: fallbackFootageFor(row),
        video: skippedVideoState(`Study video cap reached (${cap})`, now, env),
        updated_at: nowIso(now),
      });
      skipped += 1;
      continue;
    }

    reservedByStudy.set(
      row.study_id,
      (reservedByStudy.get(row.study_id) ?? 0) + 1,
    );
    await store.updateReel(row.id, {
      footage: fallbackFootageFor(row),
      video: queuedVideoState(now, env),
      updated_at: nowIso(now),
    });
    queued += 1;
  }

  return { queued, skipped };
}

async function startOne(
  store: ReelVideoStore,
  provider: VideoProvider,
  row: ReelVideoRow,
  env: NodeJS.ProcessEnv,
  now: number,
): Promise<"started" | "failed" | "skipped"> {
  const started = {
    ...startingVideoState(row.video, now),
    provider: provider.id,
  };
  await store.updateReel(row.id, {
    footage: fallbackFootageFor(row),
    video: started,
    updated_at: nowIso(now),
  });

  const prompt = buildVideoPrompt(row);
  try {
    const job = await provider.create(
      {
        prompt,
        model: videoModel(env),
        seconds: videoSeconds(env),
        resolution: videoResolution(env),
        aspectRatio: videoAspectRatio(env),
        imageUrl: referenceImageUrl(row),
      },
      env,
    );
    await store.updateReel(row.id, {
      footage: fallbackFootageFor(row),
      video: inProgressVideoState(
        started,
        job.id,
        {
          model: job.model ?? videoModel(env),
          prompt,
          provider: provider.id,
        },
        now,
      ),
      updated_at: nowIso(now),
    });
    return "started";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start video";
    const retryAfter =
      error && typeof error === "object" && "retryAfter" in error
        ? String((error as { retryAfter?: string }).retryAfter ?? "")
        : undefined;
    await store.updateReel(row.id, {
      footage: fallbackFootageFor(row),
      video: failedVideoState(started, message, now, retryAfter),
      updated_at: nowIso(now),
    });
    return "failed";
  }
}

async function pollOne(
  store: ReelVideoStore,
  provider: VideoProvider,
  row: ReelVideoRow,
  env: NodeJS.ProcessEnv,
  now: number,
): Promise<"polled" | "completed" | "failed"> {
  const jobId = row.video?.jobId;
  if (!jobId) return "failed";

  if (row.video?.provider === "openai" && provider.id !== "openai") {
    await store.updateReel(row.id, {
      footage: fallbackFootageFor(row),
      video: failedVideoState(row.video, OPENAI_VIDEOS_SHUTDOWN_MESSAGE, now),
      updated_at: nowIso(now),
    });
    return "failed";
  }

  try {
    const job = await provider.retrieve(jobId, env);
    if (job.status === "queued" || job.status === "in_progress") {
      await store.updateReel(row.id, {
        footage: fallbackFootageFor(row),
        video: {
          ...(row.video as ReelVideo),
          status: "in_progress",
          updatedAt: nowIso(now),
        },
        updated_at: nowIso(now),
      });
      return "polled";
    }
    if (job.status !== "completed") {
      const message = job.error?.message || "Video generation failed";
      await store.updateReel(row.id, {
        footage: fallbackFootageFor(row),
        video: failedVideoState(row.video, message, now),
        updated_at: nowIso(now),
      });
      return "failed";
    }

    const bytes = await provider.download(jobId, env);
    const storageId = videoStoragePath(row.id, now);
    await store.uploadVideo(storageId, bytes);
    const origin = publicStorageOrigin(env);
    const url = publicObjectUrl(origin, VIDEO_BUCKET, storageId);
    const completed = completedVideoState(
      row.video as ReelVideo,
      { storageId, jobId },
      now,
    );
    const footage = isUserUpload(row.footage)
      ? row.footage
      : {
          url,
          storageId,
          bucket: VIDEO_BUCKET,
          caption: videoCaption(row),
          media: "video" as const,
          source: { kind: "ai" as const },
        };
    await store.updateReel(row.id, {
      footage,
      video: completed,
      updated_at: nowIso(now),
    });
    return "completed";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to finish video";
    const retryAfter =
      error && typeof error === "object" && "retryAfter" in error
        ? String((error as { retryAfter?: string }).retryAfter ?? "")
        : undefined;
    await store.updateReel(row.id, {
      footage: fallbackFootageFor(row),
      video: failedVideoState(row.video, message, now, retryAfter),
      updated_at: nowIso(now),
    });
    return "failed";
  }
}

export async function processReelVideos(
  store: ReelVideoStore,
  provider: VideoProvider,
  args: {
    studyId?: string;
    env?: NodeJS.ProcessEnv;
    now?: number;
    limit?: number;
  } = {},
): Promise<ProcessVideoResult> {
  const env = args.env ?? process.env;
  const now = args.now ?? Date.now();
  const limit = args.limit ?? VIDEO_PROCESS_BATCH;
  const result: ProcessVideoResult = {
    started: 0,
    polled: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  if (!videoGenerationEnabled(env)) {
    result.skipped = 1;
    return result;
  }

  const pending = args.studyId
    ? (await store.listByStudy(args.studyId)).filter(
        (row) => shouldStartJob(row.video, now) || shouldPollJob(row.video),
      )
    : await store.listPending(limit);

  const toStart = pending
    .filter((row) => shouldStartJob(row.video, now))
    .slice(0, limit);
  const toPoll = pending
    .filter((row) => shouldPollJob(row.video))
    .slice(0, limit);
  const concurrency = videoConcurrency(env);

  const startResults = await mapWithConcurrency(toStart, concurrency, (row) =>
    startOne(store, provider, row, env, now),
  );
  for (const item of startResults) {
    if (item.status !== "fulfilled") {
      result.failed += 1;
      continue;
    }
    if (item.value === "started") result.started += 1;
    else if (item.value === "failed") result.failed += 1;
    else result.skipped += 1;
  }

  const pollResults = await mapWithConcurrency(toPoll, concurrency, (row) =>
    pollOne(store, provider, row, env, now),
  );
  for (const item of pollResults) {
    if (item.status !== "fulfilled") {
      result.failed += 1;
      continue;
    }
    if (item.value === "completed") result.completed += 1;
    else if (item.value === "failed") result.failed += 1;
    else result.polled += 1;
  }

  return result;
}

export function composeReelVideoFields(
  trackIndex: number,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): {
  footage: ReturnType<typeof fallbackFootageFor>;
  video: ReelVideo;
} {
  const footage = fallbackFootageFor({
    footage: null,
    track_index: trackIndex,
  });
  if (!videoGenerationEnabled(env)) {
    return {
      footage,
      video: skippedVideoState("AI video generation is off", now, env),
    };
  }
  return { footage, video: queuedVideoState(now, env) };
}

export function reelAlreadyHasAiVideo(
  row: Pick<ReelVideoRow, "footage" | "video">,
): boolean {
  return hasAiVideo(row.footage, row.video);
}
