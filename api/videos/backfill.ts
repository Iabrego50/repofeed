import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isAuthError,
  isInternalGenerationCall,
  requireUser,
  requireWorkspaceEditor,
} from "../_lib/auth.js";
import { dispatchVideoProcess } from "../_lib/video-chain.js";
import {
  isServerNotConfigured,
  requiredEnv,
  requireSupabaseEnv,
  sendNotConfigured,
  sendRouteError,
} from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { enqueueReelVideos } from "../../src/lib/api/reel-video-jobs.js";
import { createReelVideoStore } from "../../src/lib/api/reel-video-store.js";

export const maxDuration = 60;

function requireVideoEnv() {
  requireSupabaseEnv();
  requiredEnv("XAI_API_KEY");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    requireVideoEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  const cron = req.headers["x-vercel-cron"] === "1";
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const cronAuth =
    cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  const internal = isInternalGenerationCall(req);
  const studyId =
    typeof req.body?.studyId === "string" ? req.body.studyId : undefined;
  const reelId =
    typeof req.body?.reelId === "string" ? req.body.reelId : undefined;
  const titleContains =
    typeof req.body?.titleContains === "string"
      ? req.body.titleContains
      : undefined;
  const limit =
    Number(req.body?.limit) > 0 ? Math.min(100, Number(req.body.limit)) : 50;

  try {
    if (!cron && !cronAuth && !internal) {
      const user = await requireUser(req);
      if (!studyId && !reelId) {
        return res.status(400).json({ error: "studyId or reelId is required" });
      }
      if (studyId) {
        const { data: study } = await supabase
          .from("studies")
          .select("workspace_id")
          .eq("id", studyId)
          .maybeSingle();
        if (!study) return res.status(404).json({ error: "Study not found" });
        await requireWorkspaceEditor(user.id, study.workspace_id);
      } else if (reelId) {
        const { data: reel } = await supabase
          .from("reels")
          .select("workspace_id")
          .eq("id", reelId)
          .maybeSingle();
        if (!reel) return res.status(404).json({ error: "Reel not found" });
        await requireWorkspaceEditor(user.id, reel.workspace_id);
      }
    }

    const result = await enqueueReelVideos(createReelVideoStore(supabase), {
      studyId,
      reelId,
      titleContains,
      limit,
    });

    try {
      await dispatchVideoProcess({ studyId });
    } catch (error) {
      console.error("[videos] backfill dispatch failed", error);
    }

    return res.status(202).json({ accepted: true, ...result });
  } catch (error) {
    if (isServerNotConfigured(error)) return sendNotConfigured(res, error);
    if (isAuthError(error))
      return res.status(error.status).json({ error: error.message });
    console.error("[videos] backfill failed", error);
    return sendRouteError(res, error);
  }
}
