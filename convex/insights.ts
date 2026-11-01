import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/access";
import { EMPTY_COUNTS } from "./lib/counters";
import { authorKey } from "./lib/comments";

export type ReelRow = {
  reelId: Id<"reels">;
  studyId: Id<"studies">;
  studyTitle: string;
  title: string;
  track: string;
  views: number;
  viewers: number;
  completions: number;
  completionRate: number;
  teamViewers: number;
  teamCompletions: number;
  guestViewers: number;
  guestCompletions: number;
  trueCount: number;
  surprisedCount: number;
  pushbackCount: number;
  commentCount: number;
  openCount: number;
};
type NumericKey = Exclude<keyof ReelRow, "reelId" | "studyId" | "studyTitle" | "title" | "track">;

type Tally = { viewers: number; completions: number };
const EMPTY_TALLY: Tally = { viewers: 0, completions: 0 };

/** One view row per person per scene, so counting rows counts people. */
function tallyByReel(views: Array<{ reelId: Id<"reels">; completed: boolean }>): Map<Id<"reels">, Tally> {
  const out = new Map<Id<"reels">, Tally>();
  for (const v of views) {
    const t = out.get(v.reelId) ?? { viewers: 0, completions: 0 };
    t.viewers += 1;
    if (v.completed) t.completions += 1;
    out.set(v.reelId, t);
  }
  return out;
}

export async function studiesInScope(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  studyId: Id<"studies"> | undefined,
): Promise<Doc<"studies">[]> {
  if (studyId) {
    const s = await ctx.db.get("studies", studyId);
    return s && s.workspaceId === workspaceId && s.status === "published" ? [s] : [];
  }
  return await ctx.db
    .query("studies")
    .withIndex("by_workspace_and_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "published"),
    )
    .order("desc")
    .take(50);
}

export const summary = query({
  args: {
    workspaceId: v.id("workspaces"),
    studyId: v.optional(v.id("studies")),
  },
  handler: async (ctx, { workspaceId, studyId }) => {
    await requireRole(ctx, workspaceId, "editor");
    return await buildSummary(ctx, workspaceId, studyId);
  },
});

export type InsightSummary = Awaited<ReturnType<typeof buildSummary>>;

/** Shared by the Insights page and the slide deck. Caller must check access. */
export async function buildSummary(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  studyId: Id<"studies"> | undefined,
) {
  {
    const studies = await studiesInScope(ctx, workspaceId, studyId);
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(1000);

    const reached = new Set<Id<"users">>();
    const guestsSeen = new Set<Id<"guests">>();
    const rows: ReelRow[] = [];
    for (const study of studies) {
      const [reels, counters, views, guestViews] = await Promise.all([
        ctx.db
          .query("reels")
          .withIndex("by_study_and_position", (q) => q.eq("studyId", study._id))
          .take(100),
        ctx.db
          .query("reelCounters")
          .withIndex("by_study", (q) => q.eq("studyId", study._id))
          .take(200),
        ctx.db
          .query("reelViews")
          .withIndex("by_study", (q) => q.eq("studyId", study._id))
          .take(5000),
        ctx.db
          .query("guestViews")
          .withIndex("by_study", (q) => q.eq("studyId", study._id))
          .take(5000),
      ]);
      const team = tallyByReel(views);
      const guests = tallyByReel(guestViews);
      for (const vw of views) reached.add(vw.userId);
      for (const gv of guestViews) guestsSeen.add(gv.guestId);
      const byReel = new Map(counters.map((c) => [c.reelId, c]));
      for (const reel of reels) {
        if (!reel.enabled) continue;
        const c = byReel.get(reel._id) ?? EMPTY_COUNTS;
        const t = team.get(reel._id) ?? EMPTY_TALLY;
        const g = guests.get(reel._id) ?? EMPTY_TALLY;
        const viewers = t.viewers + g.viewers;
        const completions = t.completions + g.completions;
        rows.push({
          reelId: reel._id,
          studyId: study._id,
          studyTitle: study.title,
          title: reel.title,
          track: reel.track,
          views: c.views,
          viewers,
          completions,
          completionRate: viewers ? completions / viewers : 0,
          teamViewers: t.viewers,
          teamCompletions: t.completions,
          guestViewers: g.viewers,
          guestCompletions: g.completions,
          trueCount: c.trueCount,
          surprisedCount: c.surprisedCount,
          pushbackCount: c.pushbackCount,
          commentCount: c.commentCount,
          openCount: c.openCount,
        });
      }
    }
    const sum = (k: NumericKey) => rows.reduce((n, r) => n + r[k], 0);
    const rate = (done: number, of: number) => (of ? done / of : 0);
    const guestsReached = guestsSeen.size;
    return {
      studies: studies.map((s) => ({ _id: s._id, title: s.title })),
      reached: reached.size,
      guestsReached,
      memberCount: members.length,
      totalViews: sum("views"),
      completionRate: rate(sum("completions"), sum("viewers")),
      teamCompletionRate: rate(sum("teamCompletions"), sum("teamViewers")),
      guestCompletionRate: rate(sum("guestCompletions"), sum("guestViewers")),
      reactions: {
        true: sum("trueCount"),
        surprised: sum("surprisedCount"),
        pushback: sum("pushbackCount"),
      },
      openItems: sum("openCount"),
      rows,
    };
  }
}

export type Watcher = {
  key: string;
  name: string;
  isGuest: boolean;
  completed: boolean;
  reaction: Doc<"reactions">["kind"] | null;
  lastViewedAt: string;
};

const WATCHER_LIMIT = 200;

/** Who watched one scene, team members and named share-link guests together. */
export const watchers = query({
  args: { reelId: v.id("reels") },
  handler: async (ctx, { reelId }): Promise<Watcher[]> => {
    const reel = await ctx.db.get("reels", reelId);
    if (!reel) return [];
    await requireRole(ctx, reel.workspaceId, "editor");
    const [views, guestViews] = await Promise.all([
      ctx.db.query("reelViews").withIndex("by_reel_and_user", (q) => q.eq("reelId", reelId)).take(WATCHER_LIMIT),
      ctx.db.query("guestViews").withIndex("by_reel_and_guest", (q) => q.eq("reelId", reelId)).take(WATCHER_LIMIT),
    ]);
    const team = await Promise.all(
      views.map(async (vw): Promise<Watcher> => {
        const [user, reaction] = await Promise.all([
          ctx.db.get("users", vw.userId),
          ctx.db.query("reactions").withIndex("by_reel_and_user", (q) => q.eq("reelId", reelId).eq("userId", vw.userId)).unique(),
        ]);
        return {
          key: vw._id,
          name: user?.name ?? user?.email ?? "Someone",
          isGuest: false,
          completed: vw.completed,
          reaction: reaction?.kind ?? null,
          lastViewedAt: vw.lastViewedAt,
        };
      }),
    );
    const guests = await Promise.all(
      guestViews.map(async (gv): Promise<Watcher> => {
        const [guest, reaction] = await Promise.all([
          ctx.db.get("guests", gv.guestId),
          ctx.db.query("guestReactions").withIndex("by_reel_and_guest", (q) => q.eq("reelId", reelId).eq("guestId", gv.guestId)).unique(),
        ]);
        return {
          key: gv._id,
          name: guest?.name ?? "Guest",
          isGuest: true,
          completed: gv.completed,
          reaction: reaction?.kind ?? null,
          lastViewedAt: gv.lastViewedAt,
        };
      }),
    );
    return [...team, ...guests].sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt));
  },
});

/** All comments for CSV export. */
export const exportComments = query({
  args: {
    workspaceId: v.id("workspaces"),
    studyId: v.optional(v.id("studies")),
  },
  handler: async (ctx, { workspaceId, studyId }) => {
    await requireRole(ctx, workspaceId, "editor");
    const studies = await studiesInScope(ctx, workspaceId, studyId);
    const out = [];
    const names = new Map<string, string>();
    for (const study of studies) {
      const reels = await ctx.db
        .query("reels")
        .withIndex("by_study_and_position", (q) => q.eq("studyId", study._id))
        .take(100);
      const titles = new Map(reels.map((r) => [r._id, r.title]));
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_study", (q) => q.eq("studyId", study._id))
        .take(5000);
      for (const c of comments) {
        const key = authorKey(c);
        if (!names.has(key)) {
          if (c.userId) {
            const u = await ctx.db.get("users", c.userId);
            names.set(key, u?.name ?? u?.email ?? "Unknown");
          } else if (c.guestId) {
            const g = await ctx.db.get("guests", c.guestId);
            names.set(key, g ? `${g.name} (guest)` : "Guest");
          }
        }
        out.push({
          study: study.title,
          reel: titles.get(c.reelId) ?? "",
          kind: c.kind,
          author: names.get(key) ?? "Unknown",
          body: c.body,
          resolved: c.resolved,
          isReply: c.parentId !== undefined,
          createdAt: new Date(c._creationTime).toISOString(),
        });
      }
    }
    return out;
  },
});
