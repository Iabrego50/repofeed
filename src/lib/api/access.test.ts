import { describe, expect, it, beforeEach, vi } from "vitest";
import { supabase } from "../supabase";
import { listStudies, deleteStudy } from "./studies";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

describe("study access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listStudies filters by workspace", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: "s1", workspace_id: "ws1", title: "Study 1", status: "published", created_at: "2024-01-01", updated_at: "2024-01-01" },
              { id: "s2", workspace_id: "ws1", title: "Study 2", status: "draft", created_at: "2024-01-02", updated_at: "2024-01-02" },
            ],
            error: null,
          }),
        }),
      }),
    } as never);

    const result = await listStudies({ workspaceId: "ws1" });
    
    expect(mockFrom).toHaveBeenCalledWith("studies");
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe("s1");
    expect(result[1].title).toBe("Study 2");
  });

  it("listStudies returns empty array when no studies found", async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    } as never);

    const result = await listStudies({ workspaceId: "ws-empty" });
    
    expect(result).toHaveLength(0);
  });

  it("deleteStudy removes study and cleans up storage", async () => {
    // Mock sources query
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [
              { storage_id: "file1" },
              { storage_id: "file2" },
            ],
            error: null,
          }),
        }),
      }),
    } as never);

    // Mock delete query
    vi.mocked(supabase.from).mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never);

    // Mock storage delete
    vi.mocked(supabase.storage.from).mockReturnValue({
      remove: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    await deleteStudy({ studyId: "study1" });
    
    expect(supabase.from).toHaveBeenCalledWith("sources");
    expect(supabase.from).toHaveBeenCalledWith("studies");
    expect(supabase.storage.from).toHaveBeenCalledWith("uploads");
  });

  it("deleteStudy throws on database error", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    } as never);

    vi.mocked(supabase.from).mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ 
          error: { message: "Cannot delete study" } 
        }),
      }),
    } as never);

    await expect(deleteStudy({ studyId: "study1" }))
      .rejects.toThrow();
  });
});
