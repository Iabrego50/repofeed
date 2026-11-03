import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({ fake: null as FakeSupabase | null }));

vi.mock("../supabase", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  if (!bag.fake) bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client };
});
vi.mock("../supabase.js", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  if (!bag.fake) bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client };
});

function fake(): FakeSupabase {
  if (!bag.fake) throw new Error("fake supabase not initialized");
  return bag.fake;
}

import {
  EDITOR_LIMIT,
  FEATURE_PRO,
  FEATURE_TEAM,
  FREE_STUDY_LIMIT,
  TRIAL_DAYS,
  assertEditorSeat,
  assertPaid,
  assertStudySlot,
  countActiveStudies,
  countEditors,
  teamSeats,
} from "./limits";
import { handleStripeEvent } from "./stripe-events";
import { planSyncPayload } from "./sync-plan";

describe("plan limits", () => {
  beforeEach(() => {
    fake().reset();
  });

  it("FREE_STUDY_LIMIT is 3", () => {
    expect(FREE_STUDY_LIMIT).toBe(3);
  });

  it("TRIAL_DAYS is 14", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("EDITOR_LIMIT enforces plan rules", () => {
    expect(EDITOR_LIMIT.free).toBe(1);
    expect(EDITOR_LIMIT.pro).toBe(1);
    expect(EDITOR_LIMIT.team).toBe(Number.POSITIVE_INFINITY);
    expect(teamSeats(1)).toBe(2);
    expect(teamSeats(5)).toBe(5);
  });

  it("countActiveStudies excludes archived and demo studies", async () => {
    fake().queue("studies", { count: 2 });
    const count = await countActiveStudies("workspace-1");
    expect(count).toBe(2);
    const call = fake().lastCall("studies", "select");
    expect(fake().filterEq(call!, "workspace_id")).toBe("workspace-1");
    expect(call?.filters.some((f) => f.method === "neq" && f.args[0] === "status" && f.args[1] === "archived")).toBe(true);
    expect(call?.filters.some((f) => f.method === "neq" && f.args[0] === "is_demo" && f.args[1] === true)).toBe(true);
  });

  it("assertStudySlot throws when free plan hits limit", async () => {
    fake().queue("studies", { count: 3 });
    await expect(assertStudySlot("workspace-1", "free")).rejects.toThrow(/Free plan/);
  });

  it("assertStudySlot allows under limit", async () => {
    fake().queue("studies", { count: 2 });
    await expect(assertStudySlot("workspace-1", "free")).resolves.toBeUndefined();
  });

  it("assertStudySlot allows pro workspaces unlimited", async () => {
    await expect(assertStudySlot("workspace-1", "pro")).resolves.toBeUndefined();
    expect(fake().callsFor("studies")).toHaveLength(0);
  });

  it("assertEditorSeat throws when free plan tries to add second editor", async () => {
    fake().queue("workspace_members", { count: 1 });
    await expect(assertEditorSeat("workspace-1", "free")).rejects.toThrow(/Team plan/);
    expect(FEATURE_TEAM).toMatch(/editor/i);
  });

  it("assertEditorSeat allows team plan unlimited editors", async () => {
    await expect(assertEditorSeat("workspace-1", "team")).resolves.toBeUndefined();
  });

  it("countEditors queries owner and editor roles", async () => {
    fake().queue("workspace_members", { count: 2 });
    expect(await countEditors("ws1")).toBe(2);
    const call = fake().lastCall("workspace_members", "select");
    expect(call?.filters.some((f) => f.method === "in" && f.args[0] === "role")).toBe(true);
  });
});

describe("stripe integration", () => {
  beforeEach(() => {
    fake().reset();
  });

  it("trial period is 14 days", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(() => assertPaid("free", FEATURE_PRO)).toThrow(/Pro/);
  });

  it("checkout.session.completed writes the paid plan", async () => {
    fake().queue("workspaces", { data: { paid_plan: null, lapsed_plan: null, checkout_by: "u1" } });
    fake().queue("users", { data: { trial_used_at: null } });
    await handleStripeEvent({
      type: "checkout.session.completed",
      data: { object: { metadata: { workspace_id: "ws1", plan: "pro" } } },
    });
    expect(fake().lastCall("workspaces", "update")?.payload).toEqual({
      paid_plan: "pro",
      lapsed_plan: null,
    });
    expect(fake().lastCall("users", "update")?.payload).toEqual(expect.objectContaining({
      trial_used_at: expect.any(String),
    }));
  });

  it("subscription deleted lapses the previous plan", async () => {
    expect(planSyncPayload({ paid_plan: "pro", lapsed_plan: null }, "free")).toEqual({
      paid_plan: null,
      lapsed_plan: "pro",
    });
    fake().queue("workspaces", { data: { paid_plan: "pro", lapsed_plan: null, checkout_by: null } });
    await handleStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { metadata: { workspace_id: "ws1" } } },
    });
    expect(fake().lastCall("workspaces", "update")?.payload).toEqual({
      paid_plan: null,
      lapsed_plan: "pro",
    });
  });

  it("subscription.created during a trial writes the paid plan", async () => {
    fake().queue("workspaces", { data: { paid_plan: null, lapsed_plan: null, checkout_by: "u1" } });
    fake().queue("users", { data: { trial_used_at: null } });
    await handleStripeEvent({
      type: "customer.subscription.created",
      data: { object: { status: "trialing", metadata: { workspace_id: "ws1", plan: "pro" } } },
    });
    expect(fake().lastCall("workspaces", "update")?.payload).toEqual({
      paid_plan: "pro",
      lapsed_plan: null,
    });
  });

  it("subscription.updated keeps a paid plan while active", async () => {
    fake().queue("workspaces", { data: { paid_plan: "pro", lapsed_plan: null, checkout_by: null } });
    await handleStripeEvent({
      type: "customer.subscription.updated",
      data: { object: { status: "active", metadata: { workspace_id: "ws1", plan: "team" } } },
    });
    expect(fake().lastCall("workspaces", "update")?.payload).toEqual({
      paid_plan: "team",
      lapsed_plan: null,
    });
  });

  it("invoice.payment_failed marks lapsed_plan", async () => {
    const retrieve = vi.fn().mockResolvedValue({ metadata: { workspace_id: "ws1", plan: "team" } });
    await handleStripeEvent(
      { type: "invoice.payment_failed", data: { object: { subscription: "sub_1" } } },
      { retrieve },
    );
    expect(retrieve).toHaveBeenCalledWith("sub_1");
    expect(fake().lastCall("workspaces", "update")?.payload).toEqual({ lapsed_plan: "team" });
  });
});
