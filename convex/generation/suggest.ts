import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalQuery } from "../_generated/server";
import { requireStudy } from "../lib/access";
import { StepError } from "../lib/stepError";
import { callTool } from "./ai";

const SAMPLE_CHARS = 24_000;

/** The opening of each source file, enough for the AI to tell what the study is about. */
export const sourceSample = internalQuery({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<{ sample: string; workspaceId: Id<"workspaces"> }> => {
    const { study } = await requireStudy(ctx, studyId, "editor");
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_study", (q) => q.eq("studyId", studyId))
      .take(20);
    const per = Math.floor(SAMPLE_CHARS / Math.max(sources.length, 1));
    const sample = sources.map((s) => `File: ${s.name}\n${s.text.slice(0, per)}`).join("\n\n---\n\n");
    return { sample, workspaceId: study.workspaceId };
  },
});

const SUGGEST_SYSTEM = `You help a researcher set up a study from their raw research files.
Suggest:
- title: a short, specific study title (max 8 words), e.g. "Meal-kit cancellation interviews, Aug 2026"
- audience: who inside the company should watch the findings (max 10 words), e.g. "Product, growth and retention leads"
- goal: what that audience should walk away knowing (max 15 words)
Use only what the files say. No people's names.`;

const SUGGEST_TOOL = {
  name: "suggest_details",
  description: "Suggest study details",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      audience: { type: "string" },
      goal: { type: "string" },
    },
    required: ["title", "audience", "goal"],
  },
};

const suggestSchema = z.object({
  title: z.string().min(1),
  audience: z.string().catch(""),
  goal: z.string().catch(""),
});

export type SuggestedDetails = z.infer<typeof suggestSchema>;

export const suggestDetails = action({
  args: { studyId: v.id("studies") },
  handler: async (ctx, { studyId }): Promise<SuggestedDetails> => {
    const { sample, workspaceId } = await ctx.runQuery(internal.generation.suggest.sourceSample, { studyId });
    if (!sample.trim()) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Add a file first" });
    }
    await ctx.runMutation(internal.rateLimits.enforce, { name: "suggest", subject: workspaceId });
    try {
      const out = await callTool({
        system: SUGGEST_SYSTEM,
        user: `<files>\n${sample}\n</files>`,
        tool: SUGGEST_TOOL,
        schema: suggestSchema,
        maxTokens: 400,
      });
      return {
        title: out.title.trim().slice(0, 120),
        audience: out.audience.trim().slice(0, 200),
        goal: out.goal.trim().slice(0, 300),
      };
    } catch (err) {
      const message = err instanceof StepError ? err.message : "Couldn't suggest details";
      throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message });
    }
  },
});
