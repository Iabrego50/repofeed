import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
  COMPOSE_SYSTEM,
  COMPOSE_TOOL,
  EXTRACT_SYSTEM,
  EXTRACT_TOOL,
  callTool,
  composeSchema,
  composeUserPrompt,
  extractSchema,
  extractUserPrompt,
} from "./ai";
import { finalizeScenes, toScene } from "./scenes";
import type { Scene } from "../schema/validators";
import { StepError, toStepError } from "../lib/stepError";

const opt = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

/** One unit of work: one source chunk, the compose pass, or verification. */
export const step = internalAction({
  args: { jobId: v.id("generationJobs") },
  handler: async (ctx, { jobId }): Promise<null> => {
    const claim = await ctx.runMutation(internal.generation.jobs.claim, { jobId });
    if (claim.kind === "none") return null;

    try {
      if (claim.kind === "extract") {
        const out = await callTool({
          system: EXTRACT_SYSTEM,
          user: extractUserPrompt({
            studyTitle: claim.study.title,
            audience: claim.study.audience,
            goal: claim.study.goal,
            fileName: claim.fileName,
            chunkLabel: `part ${claim.chunkIndex + 1} of ${claim.total}`,
            text: claim.text,
          }),
          tool: EXTRACT_TOOL,
          schema: extractSchema,
          maxTokens: 16000,
        });
        await ctx.runMutation(internal.generation.jobs.saveFindings, {
          jobId,
          lease: claim.lease,
          chunkIndex: claim.chunkIndex,
          findings: out.findings.slice(0, 80).map((f) => ({
            type: f.type,
            text: f.text.trim(),
            speaker: opt(f.speaker),
            number: opt(f.number),
            label: opt(f.label),
            strength: f.strength,
          })),
        });
      } else if (claim.kind === "compose") {
        if (claim.findings.length === 0) {
          throw new StepError("We couldn't find any findings in your files.", {
            detail: "No findings were extracted from the sources",
            retryable: false,
          });
        }
        const out = await callTool({
          system: COMPOSE_SYSTEM,
          user: composeUserPrompt({
            studyTitle: claim.study.title,
            audience: claim.study.audience,
            goal: claim.study.goal,
            findings: claim.findings,
          }),
          tool: COMPOSE_TOOL,
          schema: composeSchema,
          maxTokens: 24000,
        });
        const idByKey = new Map(claim.findings.map((f) => [String(f.id), f.id]));
        const fileById = new Map(claim.findings.map((f) => [String(f.id), f.file]));
        const reels = out.reels.slice(0, 24).flatMap((r) => {
          const findingIds = r.findingIds.flatMap((id) => {
            const real = idByKey.get(id);
            return real ? [real] : [];
          });
          if (findingIds.length === 0) return [];
          const sourceNames = [
            ...new Set(findingIds.map((id) => fileById.get(String(id)) ?? "")),
          ].filter(Boolean);
          const scenes = r.scenes.map(toScene).filter((s): s is Scene => s !== null);
          const title = r.title.trim().split(/\s+/).slice(0, 6).join(" ");
          return [
            {
              track: r.track.trim(),
              title,
              scenes: finalizeScenes(scenes, title, sourceNames),
              findingIds,
              sourceNames,
            },
          ];
        });
        if (reels.length === 0) {
          throw new StepError("The AI didn't write any usable reels.", {
            detail: "No reels referenced known findings",
            retryable: true,
          });
        }
        const trackSet = [...new Set([...out.tracks, ...reels.map((r) => r.track)])].filter(
          (t) => reels.some((r) => r.track === t),
        );
        await ctx.runMutation(internal.generation.jobs.saveReels, {
          jobId,
          lease: claim.lease,
          tracks: trackSet,
          reels,
        });
      } else {
        await ctx.runMutation(internal.generation.jobs.verify, { jobId, lease: claim.lease });
        return null;
      }
    } catch (err) {
      const e = toStepError(err);
      console.error(`[generation] ${claim.kind} step failed`, e.detail);
      await ctx.runMutation(internal.generation.jobs.recordFailure, {
        jobId,
        lease: claim.lease,
        message: e.message,
        detail: e.detail,
        retryable: e.retryable,
      });
      return null;
    }
    await ctx.scheduler.runAfter(0, internal.generation.worker.step, { jobId });
    return null;
  },
});
