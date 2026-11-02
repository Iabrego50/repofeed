import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({ fake: null as FakeSupabase | null }));

vi.mock("../supabase", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client };
});

function fake(): FakeSupabase {
  if (!bag.fake) throw new Error("fake supabase not initialized");
  return bag.fake;
}

import {
  createShareLink,
  filterCommentsForGuest,
  generateGuestSecret,
  generateShareToken,
  isShareLinkLive,
  joinShare,
  loadShare,
  normalizeGuestName,
  publicTokenForReel,
  requireGuest,
  requireShareReel,
  revokeShareLink,
  shareComments,
  shareEvidence,
  shareFeed,
} from "./share";

describe("guest share links", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "owner-1", email: "owner@example.com" });
  });

  it("only editors can create links, and a second create returns the live token", async () => {
    fake().queue("studies", { data: { id: "s1", workspace_id: "ws1", status: "published" } });
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    await expect(createShareLink({ studyId: "s1" })).rejects.toThrow(/editor/);

    fake().queue("studies", { data: { id: "s1", workspace_id: "ws1", status: "published" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("share_links", { data: { token: "live-token", revoked: false } });
    expect(await createShareLink({ studyId: "s1" })).toBe("live-token");
    expect(fake().filterEq(fake().lastCall("share_links", "select")!, "study_id")).toBe("s1");
    expect(fake().filterEq(fake().lastCall("share_links", "select")!, "revoked")).toBe(false);
  });

  it("share link has a unique token and points at the study", async () => {
    const token1 = generateShareToken();
    const token2 = generateShareToken();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThanOrEqual(16);

    fake().queue("studies", { data: { id: "s1", workspace_id: "ws1", status: "published" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("share_links", { data: null });
    const token = await createShareLink({ studyId: "s1" });
    const insert = fake().lastCall("share_links", "insert");
    expect(insert?.payload).toEqual(expect.objectContaining({
      study_id: "s1",
      workspace_id: "ws1",
      token,
      created_by: "owner-1",
      revoked: false,
    }));
  });

  it("expired and revoked tokens are invalid", () => {
    const now = Date.now();
    expect(isShareLinkLive(null)).toBe(false);
    expect(isShareLinkLive({ revoked: true })).toBe(false);
    expect(isShareLinkLive({ revoked: false, expires_at: new Date(now - 1000).toISOString() })).toBe(false);
    expect(isShareLinkLive({ revoked: false, expires_at: new Date(now + 60_000).toISOString() })).toBe(true);
  });

  it("guest session secret is random and names are trimmed", () => {
    expect(generateGuestSecret()).not.toBe(generateGuestSecret());
    expect(normalizeGuestName("  Priya   Patel ")).toBe("Priya Patel");
  });

  it("unnamed visitors cannot react or comment", async () => {
    fake().queue("share_links", { data: { id: "link1", study_id: "s1", revoked: false, hide_team_comments: true } });
    fake().queue("studies", { data: { id: "s1", title: "Study", status: "published" } });
    fake().queue("guests", { data: null });
    await expect(requireGuest("tok", "made-up")).rejects.toThrow(/name/);
  });

  it("named guests join and the inserted row uses the trimmed name", async () => {
    fake().queue("share_links", { data: { id: "link1", study_id: "s1", revoked: false, hide_team_comments: true } });
    fake().queue("studies", { data: { id: "s1", title: "Study", status: "published" } });
    fake().queue("guests", { data: { id: "g1", name: "Priya Patel" } });
    const joined = await joinShare({ token: "tok", name: "  Priya   Patel " });
    expect(joined.secret.length).toBeGreaterThanOrEqual(16);
    expect(fake().lastCall("guests", "insert")?.payload).toEqual(expect.objectContaining({
      study_id: "s1",
      link_id: "link1",
      name: "Priya Patel",
      secret: joined.secret,
    }));
  });

  it("hide_team_comments filters team comments from the guest view", async () => {
    const comments = [
      { id: "c1", guest_id: null, user_id: "u1", body: "internal" },
      { id: "c2", guest_id: "g1", user_id: null, body: "spam" },
    ];
    expect(filterCommentsForGuest(comments, true).map((c) => c.body)).toEqual(["spam"]);
    expect(filterCommentsForGuest(comments, false)).toHaveLength(2);

    fake().queue("share_links", { data: { id: "link1", study_id: "s1", revoked: false, hide_team_comments: true } });
    fake().queue("studies", { data: { id: "s1", title: "Study", status: "published" } });
    fake().queue("reels", { data: { id: "r1", study_id: "s1", enabled: true } });
    fake().queue("comments", { data: comments });
    const shown = await shareComments({ token: "tok", reelId: "r1" });
    expect(shown.map((c) => c.body)).toEqual(["spam"]);
  });

  it("revoking the link or unpublishing hides the feed", async () => {
    fake().queue("studies", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    await revokeShareLink({ studyId: "s1" });
    expect(fake().lastCall("share_links", "update")?.payload).toEqual({ revoked: true });

    fake().queue("share_links", { data: { id: "link1", study_id: "s1", revoked: true, hide_team_comments: true } });
    expect(await loadShare("old")).toBeNull();
    expect(await shareFeed({ token: "old" })).toBeNull();

    fake().queue("share_links", { data: { id: "link2", study_id: "s1", revoked: false, hide_team_comments: true } });
    fake().queue("studies", { data: { id: "s1", title: "Study", status: "review" } });
    expect(await shareFeed({ token: "fresh" })).toBeNull();
  });

  it("a share token cannot reach reels from other studies", async () => {
    fake().queue("reels", { data: { id: "other", study_id: "s2", enabled: true } });
    await expect(requireShareReel("s1", "other")).rejects.toThrow(/Scene not found/);

    fake().queue("share_links", { data: { id: "link1", study_id: "s1", revoked: false, hide_team_comments: true } });
    fake().queue("studies", { data: { id: "s1", title: "Study", status: "published" } });
    fake().queue("reels", { data: { id: "other", study_id: "s2", enabled: true } });
    await expect(shareEvidence({ token: "tok", reelId: "other" })).rejects.toThrow(/Scene not found/);
  });

  it("copying a reel link resolves to the live public token only when published", async () => {
    fake().queue("reels", { data: null });
    expect(await publicTokenForReel({ reelId: "missing" })).toBeNull();

    fake().queue("reels", { data: { study_id: "s1", enabled: true } });
    fake().queue("studies", { data: { id: "s1", status: "draft" } });
    expect(await publicTokenForReel({ reelId: "r1" })).toBeNull();

    fake().queue("reels", { data: { study_id: "s1", enabled: true } });
    fake().queue("studies", { data: { id: "s1", status: "published" } });
    fake().queue("share_links", { data: { token: "pub" } });
    expect(await publicTokenForReel({ reelId: "r1" })).toBe("pub");
  });
});
