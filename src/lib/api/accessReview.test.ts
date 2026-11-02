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
  canCreateEditorInvite,
  canCreateShareLink,
  canDeleteComment,
  effectiveRole,
  inviteIsUsable,
} from "./access";
import {
  acceptInvite,
  createInvite,
  getMembers,
  getWorkspace,
  peekInvite,
  removeMember,
} from "./workspaces-complete";

describe("identity and access review", () => {
  beforeEach(() => {
    fake().reset();
    fake().setUser({ id: "other-1", email: "other@example.com" });
  });

  it("a removed person can't rejoin with an old link, but can with a new owner invite", async () => {
    fake().queue("workspace_invites", {
      data: {
        id: "inv-old",
        workspace_id: "ws1",
        role: "member",
        revoked: false,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        max_uses: null,
        uses: 0,
      },
    });
    fake().queue("workspace_members", { data: null });
    fake().queue("workspace_removals", { data: { id: "rm1" } });
    await expect(acceptInvite({ token: "old-link" })).rejects.toThrow(/removed/);

    fake().queue("workspace_invites", {
      data: {
        workspace_id: "ws1",
        role: "member",
        revoked: false,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        max_uses: null,
        uses: 0,
        workspaces: { name: "Acme" },
      },
    });
    expect((await peekInvite({ token: "old-link" })).status).toBe("ok");
  });

  it("removing someone turns off the invite links they created", async () => {
    fake().setUser({ id: "owner-1" });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspace_members", { count: 1 });
    fake().queue("workspace_members", { data: { role: "editor" } });
    await removeMember({ workspaceId: "ws1", userId: "other-1" });
    expect(fake().lastCall("workspace_removals", "insert")?.payload).toEqual({
      workspace_id: "ws1",
      user_id: "other-1",
    });
    expect(fake().lastCall("workspace_invites", "update")?.payload).toEqual({ revoked: true });
    expect(fake().filterEq(fake().lastCall("workspace_invites", "update")!, "created_by")).toBe("other-1");
  });

  it("only owners can create editor invites", async () => {
    expect(canCreateEditorInvite("owner")).toBe(true);
    expect(canCreateEditorInvite("editor")).toBe(false);
    expect(canCreateEditorInvite("member")).toBe(false);

    fake().setUser({ id: "editor-1" });
    fake().queue("workspace_members", { data: { role: "editor" } });
    await expect(createInvite({ workspaceId: "ws1", role: "editor" })).rejects.toThrow(/owners/);

    fake().setUser({ id: "owner-1" });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { paid_plan: "team" } });
    fake().queue("workspace_members", { count: 1 });
    fake().queue("workspace_invites", { data: { token: "abc" } });
    const created = await createInvite({ workspaceId: "ws1", role: "editor" });
    expect(created.token.length).toBeGreaterThanOrEqual(16);
    expect(fake().lastCall("workspace_invites", "insert")?.payload).toEqual(expect.objectContaining({
      workspace_id: "ws1",
      role: "editor",
      created_by: "owner-1",
    }));
  });

  it("editors paused by seat limits are treated as members everywhere", async () => {
    expect(effectiveRole("editor", true)).toBe("member");
    expect(effectiveRole("owner", true)).toBe("owner");
    expect(canCreateShareLink(effectiveRole("editor", true))).toBe(false);
    expect(canDeleteComment(effectiveRole("editor", true), false)).toBe(false);

    fake().setUser({ id: "editor-1" });
    fake().queue("workspace_members", { data: { role: "editor" } });
    fake().queue("workspaces", { data: { id: "ws1", name: "Acme", seat_overage: true, paid_plan: "free" } });
    const ws = await getWorkspace({ workspaceId: "ws1" });
    expect(ws.role).toBe("member");

    fake().queue("workspace_members", { data: { role: "editor" } });
    fake().queue("workspaces", { data: { seat_overage: true } });
    fake().queue("workspace_members", {
      data: [{
        id: "m1",
        user_id: "bob",
        role: "member",
        created_at: "2024-01-01T00:00:00.000Z",
        users: { name: "Bob", email: "bob@test.com", avatar: null },
      }],
    });
    const members = await getMembers({ workspaceId: "ws1" });
    expect(members[0].email).toBeUndefined();
  });

  it("members cannot see other members' emails", async () => {
    fake().setUser({ id: "member-1" });
    fake().queue("workspace_members", { data: { role: "member" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("workspace_members", {
      data: [{
        id: "m2",
        user_id: "bob",
        role: "member",
        created_at: "2024-01-01T00:00:00.000Z",
        users: { name: "Bob", email: "bob@test.com" },
      }],
    });
    const asMember = await getMembers({ workspaceId: "ws1" });
    expect(asMember[0].email).toBeUndefined();

    fake().setUser({ id: "owner-1" });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { seat_overage: false } });
    fake().queue("workspace_members", {
      data: [{
        id: "m2",
        user_id: "owner-1",
        role: "owner",
        created_at: "2024-01-01T00:00:00.000Z",
        users: { name: "Olivia", email: "owner@example.com" },
      }],
    });
    const asOwner = await getMembers({ workspaceId: "ws1" });
    expect(asOwner[0].email).toBe("owner@example.com");
  });

  it("invite token is crypto-random and expires after the specified days", async () => {
    fake().setUser({ id: "owner-1" });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { paid_plan: null } });
    fake().queue("workspace_invites", { data: { token: "tok" } });
    const a = await createInvite({ workspaceId: "ws1", role: "member" });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("workspaces", { data: { paid_plan: null } });
    fake().queue("workspace_invites", { data: { token: "tok2" } });
    const b = await createInvite({ workspaceId: "ws1", role: "member" });
    expect(a.token).not.toBe(b.token);
    const insert = fake().lastCall("workspace_invites", "insert")?.payload as { expires_at: string };
    const expires = new Date(insert.expires_at).getTime();
    expect(expires).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const expired = inviteIsUsable({
      revoked: false,
      expires_at: "2024-01-08T00:00:00.000Z",
      max_uses: 1,
      uses: 0,
    });
    expect(expired).toBe("expired");
  });
});
