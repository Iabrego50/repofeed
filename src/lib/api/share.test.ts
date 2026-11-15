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
import { guestAddComment, guestReact } from "./feed-complete";

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
    fake().queue("rpc:share_load", {
      data: {
        link: { id: "link1", study_id: "s1", token: "tok", revoked: false, hide_team_comments: true },
        study: { id: "s1", title: "Study", status: "published" },
      },
    });
    fake().queue("rpc:share_feed", {
      data: { studyTitle: "Study", hideTeamComments: true, guest: null, reels: [] },
    });
    await expect(requireGuest("tok", "made-up")).rejects.toThrow(/name/);
  });

  it("named guests join through the token-scoped RPC with a trimmed name", async () => {
    fake().queue("rpc:share_join", { data: { secret: "s".repeat(32), guestId: "g1" } });
    const joined = await joinShare({ token: "tok", name: "  Priya   Patel " });
    expect(joined.secret.length).toBeGreaterThanOrEqual(16);
    expect(joined.guestId).toBe("g1");
    expect(fake().lastCall("share_join")?.payload).toEqual({
      p_token: "tok",
      p_name: "Priya Patel",
    });
  });

  it("hide_team_comments filters team comments from the guest view", async () => {
    const comments = [
      { id: "c1", guest_id: null, user_id: "u1", body: "internal" },
      { id: "c2", guest_id: "g1", user_id: null, body: "spam" },
    ];
    expect(filterCommentsForGuest(comments, true).map((c) => c.body)).toEqual(["spam"]);
    expect(filterCommentsForGuest(comments, false)).toHaveLength(2);

    fake().queue("rpc:share_comments", {
      data: [
        {
          id: "c2",
          reel_id: "r1",
          study_id: "s1",
          user_id: null,
          guest_id: "g1",
          parent_id: null,
          kind: "note",
          body: "spam",
          resolved: false,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          users: { name: "Priya", email: null, avatar: null },
        },
      ],
    });
    const shown = await shareComments({ token: "tok", reelId: "r1" });
    expect(shown.map((c) => c.body)).toEqual(["spam"]);
    expect(fake().lastCall("share_comments")?.payload).toEqual({
      p_token: "tok",
      p_reel_id: "r1",
    });
  });

  it("revoking the link or unpublishing hides the feed", async () => {
    fake().queue("studies", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    await revokeShareLink({ studyId: "s1" });
    expect(fake().lastCall("share_links", "update")?.payload).toEqual({ revoked: true });

    fake().queue("rpc:share_load", { data: null });
    expect(await loadShare("old")).toBeNull();
    fake().queue("rpc:share_feed", { data: null });
    expect(await shareFeed({ token: "old" })).toBeNull();

    fake().queue("rpc:share_feed", { data: null });
    expect(await shareFeed({ token: "fresh" })).toBeNull();
  });

  it("shareFeed maps RPC reels and a named guest without a studies join", async () => {
    fake().queue("rpc:share_feed", {
      data: {
        studyTitle: "Published study",
        hideTeamComments: true,
        guest: { id: "g1", name: "  Priya  ", study_id: "s1", link_id: "link1" },
        reels: [
          {
            id: "r1",
            workspace_id: "ws1",
            study_id: "s1",
            position: 0,
            track: "t",
            track_index: 0,
            title: "Scene",
            scenes: [],
            finding_ids: [],
            source_names: [],
            footage: null,
            warning: null,
            enabled: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            studies: { title: "Published study" },
          },
        ],
      },
    });
    const feed = await shareFeed({ token: "tok", secret: "guest-secret" });
    expect(feed?.studyTitle).toBe("Published study");
    expect(feed?.guest?.name).toBe("Priya");
    expect(feed?.reels).toHaveLength(1);
    expect(feed?.reels[0]?.title).toBe("Scene");
    expect(fake().lastCall("share_feed")?.payload).toEqual({
      p_token: "tok",
      p_secret: "guest-secret",
    });
  });

  it("a share token cannot reach reels from other studies", async () => {
    fake().queue("reels", { data: { id: "other", study_id: "s2", enabled: true } });
    await expect(requireShareReel("s1", "other")).rejects.toThrow(/Scene not found/);

    fake().queue("rpc:share_evidence", { error: { message: "Scene not found" } });
    await expect(shareEvidence({ token: "tok", reelId: "other" })).rejects.toThrow(/Scene not found/);
  });

  it("copying a reel link resolves to the live public token only when published", async () => {
    fake().queue("rpc:share_public_token", { data: null });
    expect(await publicTokenForReel({ reelId: "missing" })).toBeNull();

    fake().queue("rpc:share_public_token", { data: null });
    expect(await publicTokenForReel({ reelId: "r1" })).toBeNull();

    fake().queue("rpc:share_public_token", { data: "pub" });
    expect(await publicTokenForReel({ reelId: "r1" })).toBe("pub");
    expect(fake().lastCall("share_public_token")?.payload).toEqual({ p_reel_id: "r1" });
  });

  it("guest reactions and comments go through token-scoped RPCs", async () => {
    fake().queue("rpc:share_react", { data: "true" });
    await expect(guestReact({ reelId: "r1", kind: "true", token: "tok", secret: "sec" })).resolves.toBe("true");
    expect(fake().lastCall("share_react")?.payload).toEqual({
      p_token: "tok",
      p_secret: "sec",
      p_reel_id: "r1",
      p_kind: "true",
    });

    fake().queue("rpc:share_add_comment", { data: { id: "c1" } });
    await guestAddComment({
      reelId: "r1",
      kind: "note",
      body: "hello",
      token: "tok",
      secret: "sec",
    });
    expect(fake().lastCall("share_add_comment")?.payload).toEqual({
      p_token: "tok",
      p_secret: "sec",
      p_reel_id: "r1",
      p_kind: "note",
      p_body: "hello",
      p_parent_id: null,
    });
  });
});
