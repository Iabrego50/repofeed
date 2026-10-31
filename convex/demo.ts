import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation } from "./_generated/server";
import { requireUser } from "./lib/access";
import { buildSourceIndex, verifyScenes } from "./lib/verify";
import { SAMPLE_FILES, SAMPLE_STUDY } from "./lib/sample";
import { DEMO_REELS, DEMO_TRACKS } from "./lib/demoReels";
import { assignFootage } from "./lib/footageLibrary";
import { enforceLimit } from "./lib/rateLimit";

/** Creates a "Demo" workspace owned by the caller with the published Supperly study. */
export const createDemoWorkspace = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"workspaces">> => {
    const user = await requireUser(ctx);
    await enforceLimit(ctx, "createWorkspace", user._id);
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Demo",
      createdBy: user._id,
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: user._id,
      role: "owner",
    });
    // Demo workspaces are for trying the app; they become billable customers only if someone upgrades one.
    const now = new Date().toISOString();
    const studyId = await ctx.db.insert("studies", {
      workspaceId,
      title: SAMPLE_STUDY.title,
      audience: SAMPLE_STUDY.audience,
      goal: SAMPLE_STUDY.goal,
      status: "published",
      tracks: DEMO_TRACKS,
      createdBy: user._id,
      publishedAt: now,
      isDemo: true,
    });
    const sourceIds = new Map<string, Id<"sources">>();
    for (const file of SAMPLE_FILES) {
      const id = await ctx.db.insert("sources", {
        studyId,
        workspaceId,
        name: file.name,
        kind: "paste",
        text: file.text,
        chars: file.text.length,
      });
      sourceIds.set(file.name, id);
    }
    const index = buildSourceIndex(SAMPLE_FILES.map((f) => f.text).join("\n\n"));
    for (const [position, reel] of DEMO_REELS.entries()) {
      const findingIds: Id<"findings">[] = [];
      for (const f of reel.findings) {
        const sourceId = sourceIds.get(f.file);
        if (!sourceId) continue;
        findingIds.push(
          await ctx.db.insert("findings", {
            studyId,
            sourceId,
            chunkIndex: -1,
            type: f.type,
            text: f.text,
            speaker: f.speaker,
            number: f.number,
            label: f.label,
            strength: f.strength,
          }),
        );
      }
      const warning = verifyScenes(reel.scenes, index);
      await ctx.db.insert("reels", {
        studyId,
        workspaceId,
        position,
        track: DEMO_TRACKS[reel.track],
        trackIndex: reel.track,
        title: reel.title,
        scenes: reel.scenes,
        findingIds,
        sourceNames: [...new Set(reel.findings.map((f) => f.file))],
        warning,
        enabled: warning === null,
        footage: reel.footage,
      });
    }
    return workspaceId;
  },
});

/** One-off: attach or refresh demo footage on reels in existing demo studies (matched by title). */
export const backfillDemoFootage = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const byTitle = new Map(DEMO_REELS.map((r) => [r.title, r.footage]));
    const studies = await ctx.db.query("studies").take(500);
    let patched = 0;
    for (const study of studies) {
      if (study.title !== SAMPLE_STUDY.title) continue;
      const reels = await ctx.db
        .query("reels")
        .withIndex("by_study_and_position", (q) => q.eq("studyId", study._id))
        .take(100);
      for (const reel of reels) {
        const footage = byTitle.get(reel.title);
        if (footage && reel.footage?.url !== footage.url) {
          await ctx.db.patch("reels", reel._id, { footage });
          patched++;
        }
      }
    }
    return patched;
  },
});

/** One-off: give reels in a study without footage the best-matching stock clip. */
export const backfillStudyFootage = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args): Promise<number> => {
    const reels = await ctx.db
      .query("reels")
      .withIndex("by_study_and_position", (q) => q.eq("studyId", args.studyId))
      .take(200);
    const footage = assignFootage(reels);
    let patched = 0;
    for (const [i, reel] of reels.entries()) {
      if (reel.footage || !footage[i]) continue;
      await ctx.db.patch("reels", reel._id, { footage: footage[i] });
      patched++;
    }
    return patched;
  },
});
