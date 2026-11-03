import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isAuthError,
  isInternalGenerationCall,
  requireUser,
  requireWorkspaceEditor,
} from "../_lib/auth.js";
import {
  isServerNotConfigured,
  requiredEnv,
  requireSupabaseEnv,
  sendNotConfigured,
  sendRouteError,
} from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { defaultOpenAIVideoClient } from "../../src/lib/ai/videos.js";
import { processReelVideos } from "../../src/lib/api/reel-video-jobs.js";
import { createReelVideoStore } from "../../src/lib/api/reel-video-store.js";

export const maxDuration = 120;

function requireVideoEnv() {
  requireSupabaseEnv();
  requiredEnv("OPENAI_API_KEY");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
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

  try {
    if (!cron && !cronAuth && !internal) {
      const user = await requireUser(req);
      if (studyId) {
        const { data: study } = await supabase
          .from("studies")
          .select("workspace_id")
          .eq("id", studyId)
          .maybeSingle();
        if (!study) return res.status(404).json({ error: "Study not found" });
        await requireWorkspaceEditor(user.id, study.workspace_id);
      } else {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const result = await processReelVideos(
      createReelVideoStore(supabase),
      defaultOpenAIVideoClient(),
      { studyId },
    );
    return res.status(202).json({ accepted: true, ...result });
  } catch (error) {
    if (isServerNotConfigured(error)) return sendNotConfigured(res, error);
    if (isAuthError(error))
      return res.status(error.status).json({ error: error.message });
    console.error("[videos] process failed", error);
    return sendRouteError(res, error);
  }
}
