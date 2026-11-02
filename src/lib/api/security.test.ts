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

import { assertEditorSeat, assertPaid, assertStudySlot, FEATURE_PRO, FEATURE_TEAM, TRIAL_DAYS } from "../billing/limits";
import { assertWorkspaceCreateAllowed, inviteIsUsable } from "./access";
import { createWorkspace, acceptInvite, peekInvite } from "./workspaces-complete";
import { saveUpload } from "./footage";
import { deleteComment, getEvidence, react } from "./feed-complete";
import { filterCommentsForGuest } from "./share";

describe("security safeguards", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "owner-1", email: "owner@example.com" });
  });

  it("assertPaid blocks free users from pro features", () => {
    expect(() => assertPaid("free", FEATURE_PRO)).toThrow(/part of Pro/);
    expect(() => assertPaid("pro", FEATURE_PRO)).not.toThrow();
    expect(() => assertPaid("team", FEATURE_PRO)).not.toThrow();
  });

  it("assertStudySlot allows pro users unlimited studies", async () => {
    await expect(assertStudySlot("ws1", "pro")).resolves.toBeUndefined();
  });

  it("assertEditorSeat allows team plan unlimited editors and names FEATURE_TEAM", async () => {
    await expect(assertEditorSeat("ws1", "team")).resolves.toBeUndefined();
    fake().queue("workspace_members", { count: 1 });
    await expect(assertEditorSeat("ws1", "free")).rejects.toThrow(new RegExp(FEATURE_TEAM.split(" ")[0]));
  });

  it("plan limits protect free tier resources", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(() => assertPaid("free", "Advanced analytics")).toThrow();
  });

  it("caps how many workspaces one person can create in a day", async () => {
    expect(() => assertWorkspaceCreateAllowed(5)).toThrow(/tomorrow/);
    fake().queue("workspaces", { count: 5 });
    await expect(createWorkspace({ name: "One too many" })).rejects.toThrow(/tomorrow/);
  });

  it("single-use invites stop working after one join, and members don't see emails", async () => {
    const used = {
      revoked: false,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      max_uses: 1,
      uses: 1,
    };
    expect(inviteIsUsable(used)).toBe("used up");
    fake().queue("workspace_invites", {
      data: { ...used, id: "inv1", workspace_id: "ws1", role: "member" },
    });
    await expect(acceptInvite({ token: "used" })).rejects.toThrow(/used up/);

    fake().queue("workspace_invites", {
      data: { ...used, workspaces: { name: "Acme" } },
    });
    expect((await peekInvite({ token: "used" })).status).toBe("used up");
  });

  it("an upload can't be attached by a second workspace", async () => {
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("upload_claims", { data: { id: "c1", workspace_id: "ws-a" } });
    await expect(saveUpload({ workspaceId: "ws-b", storageId: "file-1", name: "Stolen" })).rejects.toThrow(
      /another workspace/,
    );
  });

  it("editors can delete guest comments, and guests don't see team comments by default", async () => {
    const comments = [
      { id: "c-guest", guest_id: "g1", user_id: null, body: "spam" },
      { id: "c-team", guest_id: null, user_id: "owner-1", body: "internal" },
    ];
    expect(filterCommentsForGuest(comments, true).map((c) => c.body)).toEqual(["spam"]);

    fake().setUser({ id: "member-1" });
    fake().queue("comments", { data: { reel_id: "r1", user_id: null } });
    fake().queue("reels", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "member" } });
    await expect(deleteComment({ commentId: "c-guest" })).rejects.toThrow(/authorized/);

    fake().setUser({ id: "owner-1" });
    fake().queue("comments", { data: { reel_id: "r1", user_id: null } });
    fake().queue("reels", { data: { workspace_id: "ws1" } });
    fake().queue("workspace_members", { data: { role: "owner" } });
    await deleteComment({ commentId: "c-guest" });
    expect(fake().filterEq(fake().lastCall("comments", "delete")!, "id")).toBe("c-guest");
  });

  it("members can't interact with scenes an editor turned off", async () => {
    fake().setUser({ id: "member-1" });
    fake().queue("reels", { data: { finding_ids: ["f1"], enabled: false, workspace_id: "ws1" } });
    await expect(getEvidence({ reelId: "r1" })).rejects.toThrow(/Scene not found/);

    fake().queue("reels", { data: { study_id: "s1", workspace_id: "ws1" } });
    fake().queue("reels", { data: { enabled: false } });
    await expect(react({ reelId: "r1", kind: "true" })).rejects.toThrow(/Scene not found/);
  });
});
