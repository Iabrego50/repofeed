import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getMembership } from "./access";
import { tryConsume } from "./rateLimit";
import { feedbackEmail, studyPublishedEmail, type EmailMessage, type FeedbackKind } from "./emailTemplates";

// Large workspaces get the first this-many members; keeps one publish within mutation limits.
const MAX_PUBLISH_RECIPIENTS = 500;
// Split big send lists over several scheduled runs so each one stays short.
const SEND_BATCH = 50;

export type Prefs = { newStudies: boolean; feedback: boolean };

export async function getPrefs(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
): Promise<Prefs> {
  const row = await ctx.db
    .query("emailPrefs")
    .withIndex("by_workspace_and_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .unique();
  return { newStudies: row?.newStudies ?? true, feedback: row?.feedback ?? true };
}

async function queue(ctx: MutationCtx, messages: EmailMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += SEND_BATCH) {
    await ctx.scheduler.runAfter(0, internal.emails.send, { messages: messages.slice(i, i + SEND_BATCH) });
  }
}

const displayName = (u: Doc<"users"> | null) => u?.name ?? u?.email ?? "A teammate";

/** Emails everyone in the workspace (except the publisher) the first time a study goes live. */
export async function notifyStudyPublished(
  ctx: MutationCtx,
  study: Doc<"studies">,
  publisher: Doc<"users">,
): Promise<void> {
  if (study.isDemo) return;
  const workspace = await ctx.db.get("workspaces", study.workspaceId);
  if (!workspace) return;
  const sceneCount = (
    await ctx.db
      .query("reels")
      .withIndex("by_study_and_position", (q) => q.eq("studyId", study._id))
      .take(100)
  ).filter((r) => r.enabled).length;
  const members = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", study.workspaceId))
    .take(MAX_PUBLISH_RECIPIENTS);
  const messages: EmailMessage[] = [];
  for (const m of members) {
    if (m.userId === publisher._id) continue;
    const [user, prefs] = await Promise.all([
      ctx.db.get("users", m.userId),
      getPrefs(ctx, study.workspaceId, m.userId),
    ]);
    if (!user?.email || !prefs.newStudies) continue;
    messages.push(
      studyPublishedEmail({
        to: user.email,
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        studyId: study._id,
        studyTitle: study.title,
        publisherName: displayName(publisher),
        sceneCount,
      }),
    );
  }
  await queue(ctx, messages);
}

export type Actor = { userId: Id<"users"> } | { guestName: string };

/**
 * Emails one workspace member about feedback on a scene. Skips people who left,
 * turned feedback emails off, have no email, or are the one giving the feedback.
 * Capped per recipient so a burst of activity can't flood an inbox.
 */
export async function notifyFeedback(
  ctx: MutationCtx,
  args: {
    recipientId: Id<"users"> | undefined;
    reel: Doc<"reels">;
    actor: Actor;
    kind: FeedbackKind;
    body?: string;
  },
): Promise<void> {
  const { recipientId, reel, actor } = args;
  if (!recipientId) return;
  if ("userId" in actor && actor.userId === recipientId) return;
  const [recipient, membership, prefs, workspace] = await Promise.all([
    ctx.db.get("users", recipientId),
    getMembership(ctx, reel.workspaceId, recipientId),
    getPrefs(ctx, reel.workspaceId, recipientId),
    ctx.db.get("workspaces", reel.workspaceId),
  ]);
  if (!recipient?.email || !membership || !prefs.feedback || !workspace) return;
  if (!(await tryConsume(ctx, "feedbackEmail", recipientId))) return;
  const actorName =
    "userId" in actor ? displayName(await ctx.db.get("users", actor.userId)) : `${actor.guestName} (guest)`;
  await queue(ctx, [
    feedbackEmail({
      to: recipient.email,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      reelId: reel._id,
      reelTitle: reel.title,
      actorName,
      kind: args.kind,
      body: args.body,
    }),
  ]);
}

/**
 * After a new comment: questions go to the study's author, and replies go to
 * the person who wrote the comment being replied to.
 */
export async function notifyComment(
  ctx: MutationCtx,
  reel: Doc<"reels">,
  actor: Actor,
  comment: { kind: Doc<"comments">["kind"]; body: string; parentId?: Id<"comments"> },
): Promise<void> {
  const body = comment.body.trim();
  if (comment.parentId) {
    const parent = await ctx.db.get("comments", comment.parentId);
    await notifyFeedback(ctx, { recipientId: parent?.userId, reel, actor, kind: "reply", body });
    return;
  }
  if (comment.kind !== "question") return;
  const study = await ctx.db.get("studies", reel.studyId);
  await notifyFeedback(ctx, { recipientId: study?.createdBy, reel, actor, kind: "question", body });
}

/** After a reaction is set: a new Push back goes to the study's author. */
export async function notifyReaction(
  ctx: MutationCtx,
  reel: Doc<"reels">,
  actor: Actor,
  kind: Doc<"reactions">["kind"],
): Promise<void> {
  if (kind !== "pushback") return;
  const study = await ctx.db.get("studies", reel.studyId);
  await notifyFeedback(ctx, { recipientId: study?.createdBy, reel, actor, kind: "pushback" });
}
