import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

type Message = { to: string; subject: string; text: string };

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: "test|owner", name: "Olivia", email: "owner@example.com" });
  const member = t.withIdentity({ tokenIdentifier: "test|member", name: "Marco", email: "member@example.com" });
  for (const u of [owner, member]) await u.mutation(api.users.updateCurrentUser, {});
  const workspaceId = await owner.mutation(api.demo.createDemoWorkspace, {});
  const invite = await owner.mutation(api.workspaces.createInvite, { workspaceId, role: "member", expiresInDays: 1 });
  await member.mutation(api.workspaces.acceptInvite, { token: invite });
  const reels = await owner.query(api.feed.list, { workspaceId });
  return { t, owner, member, workspaceId, studyId: reels[0].studyId, reelId: reels[0]._id };
}

/** Every email message queued so far, across all scheduled sends. */
async function queued(t: ReturnType<typeof convexTest>): Promise<Message[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.startsWith("emails"))
    .flatMap((j) => (j.args[0] as { messages: Message[] }).messages);
}

describe("email updates", () => {
  it("emails the study author when someone pushes back, but not for their own reactions", async () => {
    const { t, owner, member, reelId } = await setup();
    await owner.mutation(api.feed.setReaction, { reelId, kind: "pushback" });
    await member.mutation(api.feed.setReaction, { reelId, kind: "true" });
    expect(await queued(t)).toHaveLength(0);
    await member.mutation(api.feed.setReaction, { reelId, kind: "pushback" });
    const sent = await queued(t);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("owner@example.com");
    expect(sent[0].subject).toContain("Marco pushed back on");
  });

  it("respects the feedback switch, which is per person", async () => {
    const { t, owner, member, workspaceId, reelId } = await setup();
    await owner.mutation(api.emailPrefs.set, { workspaceId, feedback: false });
    expect(await owner.query(api.emailPrefs.get, { workspaceId })).toMatchObject({ feedback: false, newStudies: true });
    expect(await member.query(api.emailPrefs.get, { workspaceId })).toMatchObject({ feedback: true });
    await member.mutation(api.feed.addComment, { reelId, kind: "question", body: "Which cities?" });
    expect(await queued(t)).toHaveLength(0);
  });

  it("guest questions reach the author, and replies reach the comment's writer", async () => {
    const { t, owner, member, studyId, reelId } = await setup();
    const token = await owner.mutation(api.share.createLink, { studyId });
    const { secret } = await t.mutation(api.share.join, { token, name: "Priya" });
    await t.mutation(api.share.addComment, { token, secret, reelId, kind: "question", body: "Is this <b>US</b> only?" });
    // Notes don't email anyone.
    await member.mutation(api.feed.addComment, { reelId, kind: "note", body: "Nice" });
    let sent = await queued(t);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "owner@example.com" });
    expect(sent[0].subject).toContain("Priya (guest) asked a question");

    const [note] = (await owner.query(api.feed.comments, { reelId })).filter((c) => c.kind === "note");
    await owner.mutation(api.feed.addComment, { reelId, kind: "note", body: "Thanks!", parentId: note._id });
    sent = await queued(t);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ to: "member@example.com" });
    expect(sent[1].subject).toContain("Olivia replied to your comment");
  });

  it("the first publish emails teammates who want it, never the publisher", async () => {
    const { t, owner, member, workspaceId, studyId } = await setup();
    // Treat the sample as a real, never-published study.
    await t.run((ctx) => ctx.db.patch("studies", studyId, { isDemo: false, publishedAt: undefined, status: "review" }));
    await owner.mutation(api.studies.setPublished, { studyId, published: true });
    let sent = await queued(t);
    expect(sent.map((m) => m.to)).toEqual(["member@example.com"]);
    expect(sent[0].text).toContain(`/feed?study=${studyId}`);

    // Republishing later stays quiet.
    await owner.mutation(api.studies.setPublished, { studyId, published: false });
    await owner.mutation(api.studies.setPublished, { studyId, published: true });
    expect(await queued(t)).toHaveLength(1);

    await member.mutation(api.emailPrefs.set, { workspaceId, newStudies: false });
    await t.run((ctx) => ctx.db.patch("studies", studyId, { publishedAt: undefined, status: "review" }));
    await owner.mutation(api.studies.setPublished, { studyId, published: true });
    sent = await queued(t);
    expect(sent).toHaveLength(1);
  });
});
