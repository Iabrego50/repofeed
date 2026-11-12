import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { isAuthError, requireUser } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { callTool } from "../../src/lib/ai/client.js";
import {
  ASK_SYSTEM,
  ASK_TOOL,
  askCandidates,
  askPrompt,
  cleanTopics,
  keywordAnswer,
  sanitizeAnswer,
  withTopics,
} from "../../src/lib/research-search.js";
import { loadLibrary, readBody } from "./_library.js";

const answerSchema = z.object({ answer: z.string().default(""), insights: z.array(z.object({ id: z.string(), why: z.string().nullish() })).default([]) });

/** One question can take a while for a big workspace; past this the reader gets keyword matches instead. */
const ASK_TIMEOUT_MS = 45_000;

/**
 * POST { workspaceId, question, topics? }
 * Answers a question from the workspace's own insights, citing the ones it used.
 * Without an AI key, or if the AI call fails, it returns the closest keyword
 * matches and no written answer, so search still works.
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
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (!workspaceId || question.length < 2) {
      return res.status(400).json({ error: "Type a question or a few words to search for." });
    }

    const library = await loadLibrary(supabase, workspaceId, user.id);
    if (!library) return res.status(403).json({ error: "You’re not a member of this workspace." });
    res.setHeader("Cache-Control", "no-store");
    // Asking with topics selected answers from those topics only.
    const scope = withTopics(library.insights, cleanTopics(body.topics));
    if (scope.length === 0) {
      return res.status(200).json({ mode: "keyword", answer: null, insights: [], searched: 0 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json(keywordAnswer(scope, question));
    }

    const candidates = askCandidates(scope, question);
    try {
      const raw = await callTool({
        system: ASK_SYSTEM,
        user: askPrompt(question, candidates),
        tool: ASK_TOOL,
        schema: answerSchema,
        maxTokens: 1500,
        timeoutMs: ASK_TIMEOUT_MS,
      });
      return res.status(200).json(sanitizeAnswer(raw, new Set(candidates.map((c) => c.id)), scope.length));
    } catch (error) {
      console.warn("[ask] AI answer failed, returning keyword matches", error instanceof Error ? error.message : error);
      return res.status(200).json({ ...keywordAnswer(scope, question), notice: "ai_unavailable" });
    }
  } catch (error) {
    if (isAuthError(error)) return res.status(error.status).json({ error: "Sign in to search your research." });
    return sendRouteError(res, error);
  }
}
