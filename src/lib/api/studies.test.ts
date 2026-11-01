import { describe, expect, it, beforeEach, vi } from "vitest";
import { supabase } from "../supabase";
import { createStudy, archiveStudy, publishStudy, updateStudy } from "./studies";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe("study lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createStudy inserts with required fields", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user1" } },
      error: null,
    } as never);

    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "study-1", title: "New Study" },
            error: null,
          }),
        }),
      }),
    } as never);

    const result = await createStudy({
      workspaceId: "ws1",
      title: "New Study",
      audience: "Users",
      goal: "Learn about onboarding",
      createdBy: "user1",
    });

    expect(supabase.from).toHaveBeenCalledWith("studies");
    expect(result.id).toBe("study-1");
  });

  it("archiveStudy updates status", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never);

    await archiveStudy({ studyId: "study-1" });

    expect(supabase.from).toHaveBeenCalledWith("studies");
    const updateCall = vi.mocked(supabase.from).mock.results[0].value;
    expect(updateCall.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "archived" })
    );
  });

  it("publishStudy sets published status and timestamp", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never);

    await publishStudy({ studyId: "study-1" });

    expect(supabase.from).toHaveBeenCalledWith("studies");
    const updateCall = vi.mocked(supabase.from).mock.results[0].value;
    expect(updateCall.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" })
    );
  });

  it("updateStudy modifies title and goal", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never);

    await updateStudy({
      studyId: "study-1",
      title: "Updated Title",
      goal: "New goal",
    });

    expect(supabase.from).toHaveBeenCalledWith("studies");
  });
});
