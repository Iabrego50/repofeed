import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, query, type ActionCtx, type QueryCtx } from "./_generated/server";
import { getMembership, hasRole, requireRole, withEffectiveRole } from "./lib/access";
import { buildSummary, studiesInScope, type InsightSummary } from "./insights";
import { resolveAuthors, authorKey } from "./lib/comments";
import { callTool } from "./generation/ai";
import { DECK_SYSTEM, DECK_TOOL, deckSchema, sanitizeDeck, type DeckComment, type DeckFinding, type DeckSlide } from "./lib/deck";
import { StepError } from "./lib/stepError";
import { deckReelValidator, deckSlideValidator, deckStatsValidator } from "./schema/validators";

const MAX_COMMENTS = 40;
const MAX_REELS = 40;
const MAX_FINDINGS = 90;
const FINDINGS_SCAN = 400;

type DeckInput = {
  userId: Id<"users">;
  scopeLabel: string;
  audience: string;
  studyContext: string[];
  summary: InsightSummary;
  comments: DeckComment[];
  findings: DeckFinding[];
};

/** The strongest findings across the studies in scope, spread fairly between studies. */
async function gatherFindings(ctx: QueryCtx, studies: Doc<"studies">[]): Promise<DeckFinding[]> {
  const perStudy = Math.max(15, Math.ceil(MAX_FINDINGS / Math.max(studies.length, 1)));
  const out: DeckFinding[] = [];
  for (const s of studies) {
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_study", (q) => q.eq("studyId", s._id))
      .take(FINDINGS_SCAN);
    const top = rows.sort((a, b) => b.strength - a.strength).slice(0, perStudy);
    out.push(
      ...top.map((f) => ({
        type: f.type,
        text: f.text.slice(0, 500),
        speaker: f.speaker,
        number: f.number,
        label: f.label,
        study: s.title,
      })),
    );
  }
  return out.slice(0, MAX_FINDINGS);
}

/** Collects the study findings, plus the light engagement data, the deck is written from. */
export const gatherInput = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    studyId: v.optional(v.id("studies")),
    // Set only by internal callers that already know who the deck is for.
    asUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, { workspaceId, studyId, asUserId }): Promise<DeckInput> => {
    let userId: Id<"users">;
    if (asUserId) {
      const stored = await getMembership(ctx, workspaceId, asUserId);
      const m = stored ? await withEffectiveRole(ctx, stored) : null;
      if (!m || !hasRole(m.role, "editor")) throw new ConvexError({ code: "FORBIDDEN", message: "Only workspace editors can do this" });
      userId = asUserId;
    } else {
      userId = (await requireRole(ctx, workspaceId, "editor")).user._id;
    }
    const summary = await buildSummary(ctx, workspaceId, studyId);
    const studies = await studiesInScope(ctx, workspaceId, studyId);
    const reelTitles = new Map(summary.rows.map((r) => [r.reelId, r.title]));

    const rows: Doc<"comments">[] = [];
    for (const s of studies) {
      if (rows.length >= MAX_COMMENTS) break;
      const recent = await ctx.db
        .query("comments")
        .withIndex("by_study", (q) => q.eq("studyId", s._id))
        .order("desc")
        .take(MAX_COMMENTS);
      // Only team comments feed the AI; outside guests can't steer what the deck says.
      rows.push(...recent.filter((c) => c.userId !== undefined && reelTitles.has(c.reelId)));
    }
    const kept = rows.slice(0, MAX_COMMENTS);
    const authors = await resolveAuthors(ctx, kept);
    const comments = kept.map((c) => ({
      body: c.body.slice(0, 400),
      by: authors.get(authorKey(c))?.name ?? "Someone",
      kind: c.kind,
      reel: reelTitles.get(c.reelId) ?? "",
    }));

    return {
      userId,
      scopeLabel: studyId ? studies[0]?.title ?? "Study" : "All published studies",
      audience: studies[0]?.audience ?? "the team",
      studyContext: studies.map((s) => `${s.title} (audience: ${s.audience}${s.goal ? `; goal: ${s.goal}` : ""})`),
      summary,
      comments,
      findings: await gatherFindings(ctx, studies),
    };
  },
});

function findingLine(f: DeckFinding, multiStudy: boolean): string {
  const meta = [f.speaker && `speaker: ${f.speaker}`, f.number && `number: ${f.number}`, f.label && `label: ${f.label}`, multiStudy && f.study && `study: ${f.study}`]
    .filter(Boolean)
    .join(", ");
  return `- [${f.type}] ${f.text}${meta ? ` (${meta})` : ""}`;
}

function deckPrompt(input: DeckInput): string {
  const s = input.summary;
  const multi = s.studies.length > 1;
  const reels = [...s.rows].sort((a, b) => b.viewers - a.viewers).slice(0, MAX_REELS);
  const reelLines = reels.map(
    (r) => `- "${r.title}" (theme: ${r.track}${multi ? `, study: ${r.studyTitle}` : ""}) rings true ${r.trueCount}, surprised ${r.surprisedCount}, push back ${r.pushbackCount}`,
  );
  const commentLines = input.comments.map((c) => `- [${c.kind}] on "${c.reel}" by ${c.by}: ${c.body}`);
  return `Deck covers: ${input.scopeLabel}
Studies:
${input.studyContext.map((c) => `- ${c}`).join("\n")}

RESEARCH FINDINGS (the substance of the deck, strongest first):
${input.findings.length ? input.findings.map((f) => findingLine(f, multi)).join("\n") : "(none)"}

Themes the findings were grouped into (reel titles, for reelTitle only):
${reelLines.join("\n")}

How the team received it (use lightly, only on the reactions slide):
- Reactions overall: rings true ${s.reactions.true}, surprised me ${s.reactions.surprised}, push back ${s.reactions.pushback}

Team comments (context only, may hint at open questions):
${commentLines.length ? commentLines.join("\n") : "(none yet)"}`;
}

export const store = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    scope: v.union(v.id("studies"), v.literal("all")),
    scopeLabel: v.string(),
    createdBy: v.id("users"),
    slides: v.array(deckSlideValidator),
    stats: deckStatsValidator,
    reels: v.array(deckReelValidator),
  },
  handler: async (ctx, args): Promise<Id<"decks">> => {
    // Keep only the newest deck per scope so the table stays small.
    const old = await ctx.db
      .query("decks")
      .withIndex("by_workspace_and_scope", (q) => q.eq("workspaceId", args.workspaceId).eq("scope", args.scope))
      .take(20);
    for (const d of old) await ctx.db.delete("decks", d._id);
    return await ctx.db.insert("decks", args);
  },
});

/** The most recent deck for the current Insights scope, or null. */
export const latest = query({
  args: { workspaceId: v.id("workspaces"), studyId: v.optional(v.id("studies")) },
  handler: async (ctx, { workspaceId, studyId }) => {
    await requireRole(ctx, workspaceId, "editor");
    return await ctx.db
      .query("decks")
      .withIndex("by_workspace_and_scope", (q) => q.eq("workspaceId", workspaceId).eq("scope", studyId ?? "all"))
      .order("desc")
      .first();
  },
});

type DeckArgs = { workspaceId: Id<"workspaces">; studyId?: Id<"studies">; asUserId?: Id<"users"> };

async function createDeck(ctx: ActionCtx, args: DeckArgs): Promise<Id<"decks">> {
  const { workspaceId, studyId } = args;
  {
    const input: DeckInput = await ctx.runQuery(internal.decks.gatherInput, args);
    if (input.summary.rows.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Publish a study first. There's nothing to present yet." });
    }
    await ctx.runMutation(internal.rateLimits.enforce, { name: "deck", subject: workspaceId });
    let slides: DeckSlide[];
    try {
      const raw = await callTool({
        system: DECK_SYSTEM,
        user: deckPrompt(input),
        tool: DECK_TOOL,
        schema: deckSchema,
        maxTokens: 6000,
      });
      slides = sanitizeDeck(raw, {
        reelTitles: input.summary.rows.map((r) => r.title),
        comments: input.comments,
        findings: input.findings,
        fallbackTitle: input.scopeLabel,
      });
    } catch (err) {
      if (err instanceof StepError) {
        throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: `${err.message} Try again in a moment.` });
      }
      throw err;
    }
    const s = input.summary;
    return await ctx.runMutation(internal.decks.store, {
      workspaceId,
      scope: studyId ?? "all",
      scopeLabel: input.scopeLabel,
      createdBy: input.userId,
      slides,
      stats: {
        reached: s.reached,
        memberCount: s.memberCount,
        guestsReached: s.guestsReached,
        totalViews: s.totalViews,
        completionRate: s.completionRate,
        openItems: s.openItems,
        reactions: s.reactions,
      },
      reels: [...s.rows]
        .sort((a, b) => b.viewers - a.viewers)
        .slice(0, MAX_REELS)
        .map((r) => ({
          title: r.title,
          track: r.track,
          studyTitle: r.studyTitle,
          views: r.views,
          viewers: r.viewers,
          completionRate: r.completionRate,
          trueCount: r.trueCount,
          surprisedCount: r.surprisedCount,
          pushbackCount: r.pushbackCount,
          commentCount: r.commentCount,
          openCount: r.openCount,
        })),
    });
  }
}

export const generate = action({
  args: { workspaceId: v.id("workspaces"), studyId: v.optional(v.id("studies")) },
  handler: async (ctx, args): Promise<Id<"decks">> => {
    await ctx.runAction(internal.billing.actions.requirePaid, { workspaceId: args.workspaceId, feature: "AI readout decks" });
    return await createDeck(ctx, args);
  },
});

/** Admin/testing entry point: builds a deck on behalf of a specific editor. */
export const generateFor = internalAction({
  args: { workspaceId: v.id("workspaces"), studyId: v.optional(v.id("studies")), asUserId: v.id("users") },
  handler: async (ctx, args): Promise<Id<"decks">> => await createDeck(ctx, args),
});
