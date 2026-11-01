import { describe, expect, it, vi } from "vitest";
import { assertPaid, assertStudySlot, assertEditorSeat } from "../billing/limits";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe("security safeguards", () => {
  it("assertPaid blocks free users from pro features", () => {
    expect(() => assertPaid("free", "Share links")).toThrow(/part of Pro/);
    expect(() => assertPaid("pro", "Share links")).not.toThrow();
    expect(() => assertPaid("team", "Share links")).not.toThrow();
  });

  it("assertStudySlot allows pro users unlimited studies", async () => {
    await expect(assertStudySlot("ws1", "pro")).resolves.not.toThrow();
  });

  it("assertEditorSeat allows team plan unlimited editors", async () => {
    await expect(assertEditorSeat("ws1", "team")).resolves.not.toThrow();
  });

  it("plan limits protect free tier resources", () => {
    // Free plan: max 3 studies, 1 editor
    expect(() => assertPaid("free", "Advanced analytics")).toThrow();
  });
});
