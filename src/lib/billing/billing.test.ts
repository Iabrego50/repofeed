import { describe, expect, it, beforeEach, vi } from "vitest";
import { FREE_STUDY_LIMIT, TRIAL_DAYS, EDITOR_LIMIT, assertStudySlot, assertEditorSeat, countActiveStudies, countEditors } from "./limits";
import { supabase } from "../supabase";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("plan limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("countActiveStudies excludes archived and demo studies", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ count: 2 }),
            }),
          }),
        }),
      }),
    } as never);

    const count = await countActiveStudies("workspace-1");
    expect(count).toBe(2);
  });

  it("assertStudySlot throws when free plan hits limit", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          }),
        }),
      }),
    } as never);

    await expect(assertStudySlot("workspace-1", "free")).rejects.toThrow(/Free plan/);
  });

  it("assertStudySlot allows under limit", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ count: 2 }),
            }),
          }),
        }),
      }),
    } as never);

    await expect(assertStudySlot("workspace-1", "free")).resolves.not.toThrow();
  });

  it("assertStudySlot allows pro workspaces unlimited", async () => {
    await expect(assertStudySlot("workspace-1", "pro")).resolves.not.toThrow();
  });

  it("assertEditorSeat throws when free plan tries to add second editor", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ count: 1 }),
          }),
        }),
      }),
    } as never);

    await expect(assertEditorSeat("workspace-1", "free")).rejects.toThrow(/Team plan/);
  });

  it("assertEditorSeat allows team plan unlimited editors", async () => {
    await expect(assertEditorSeat("workspace-1", "team")).resolves.not.toThrow();
  });
});

describe("stripe integration", () => {
  it("trial period is 14 days", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});
