import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isInternalGenerationCall } from "../_lib/auth.js";
import { dispatchGenerationProcess } from "../_lib/generation-chain.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { STALE_JOB_MS } from "../../src/lib/api/generation-guards.js";
import { defaultOpenAIVideoClient } from "../../src/lib/ai/videos.js";
import {
  enqueueReelVideos,
  processReelVideos,
} from "../../src/lib/api/reel-video-jobs.js";
import { createReelVideoStore } from "../../src/lib/api/reel-video-store.js";

/**
 * Optional stale-job sweeper. Vercel Hobby crons only run daily, so the open
 * generate tab (status poll → POST /api/generation/process) is the real
 * self-heal. This route is a backup.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  const cron = req.headers["x-vercel-cron"] === "1";
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const cronAuth =
    cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  if (!cron && !cronAuth && !isInternalGenerationCall(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cutoff = new Date(Date.now() - STALE_JOB_MS).toISOString();
  const { data: jobs, error } = await supabase
    .from("generation_jobs")
    .select("id, phase, status, updated_at")
    .in("status", ["queued", "running"])
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[generation] recover list failed", error);
    return res.status(500).json({ error: "Failed to list stale jobs" });
  }

  const dispatched: string[] = [];
  for (const job of jobs ?? []) {
    try {
      await dispatchGenerationProcess(job.id);
      dispatched.push(job.id);
    } catch (dispatchError) {
      console.error(
        `[generation] recover dispatch failed job=${job.id}`,
        dispatchError,
      );
    }
  }

  let videos = {
    queued: 0,
    skipped: 0,
    started: 0,
    polled: 0,
    completed: 0,
    failed: 0,
  };
  try {
    const store = createReelVideoStore(supabase);
    const enqueued = await enqueueReelVideos(store, { limit: 40 });
    const processed = await processReelVideos(
      store,
      defaultOpenAIVideoClient(),
    );
    videos = { ...enqueued, ...processed };
  } catch (videoError) {
    console.error("[generation] recover videos failed", videoError);
  }

  return res.status(202).json({
    accepted: true,
    stale: (jobs ?? []).length,
    dispatched: dispatched.length,
    videos,
  });
}
