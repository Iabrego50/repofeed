import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { isAuthError, requireUser } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { callTool } from "../../src/lib/ai/client.js";
import { TOPIC_SYSTEM, TOPIC_TOOL, sanitizeTopics, topicCounts, topicPrompt } from "../../src/lib/research-search.js";
import { loadLibrary, readBody } from "./_library.js";

/** Insights tagged per call. The page calls again while untagged ones remain. */
const BATCH = 40;

const topicSchema = z.object({ insights: z.array(z.object({ id: z.string(), topics: z.array(z.string()).default([]) })).default([]) });

/**
 * POST { workspaceId } — tags up to 40 insights that have no topics yet.
 * Insights made before topics existed get tagged this way the first time someone
 * opens Explore. Returns how many were tagged and how many are still waiting.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  try {
    const user = await requireUser(req, supabase);
    const body = readBody(req.body);
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) return res.status(400).json({ error: "Missing workspace" });

    const library = await loadLibrary(supabase, workspaceId, user.id);
    if (!library) return res.status(403).json({ error: "You’re not a member of this workspace." });

    const untagged = library.insights.filter((i) => i.topics.length === 0);
    if (untagged.length === 0) return res.status(200).json({ tagged: 0, remaining: 0 });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ tagged: 0, remaining: untagged.length, notice: "ai_unavailable" });
    }

    const batch = untagged.slice(0, BATCH);
    const existing = topicCounts(library.insights).map((t) => t.topic);
    const raw = await callTool({
      system: TOPIC_SYSTEM,
      user: topicPrompt(batch, existing),
      tool: TOPIC_TOOL,
      schema: topicSchema,
      maxTokens: 3000,
    });
    const tags = sanitizeTopics(raw, new Set(batch.map((i) => i.id)));

    let tagged = 0;
    for (const [id, topics] of tags) {
      // Only fill topics that are still empty, so an editor's own tags are never overwritten.
      const { data, error } = await supabase.from("reels").update({ topics }).eq("id", id).eq("topics", "{}").select("id");
      if (error) throw new Error(error.message);
      tagged += data?.length ?? 0;
    }
    return res.status(200).json({ tagged, remaining: Math.max(0, untagged.length - tagged) });
  } catch (error) {
    if (isAuthError(error)) return res.status(error.status).json({ error: "Sign in to search your research." });
    return sendRouteError(res, error);
  }
}
