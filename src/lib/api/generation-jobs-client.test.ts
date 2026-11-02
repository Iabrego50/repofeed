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

import { startGeneration } from "./generation-jobs";
import { jsonAuthHeaders } from "./bearer";

describe("client generation and paint auth headers", () => {
  beforeEach(() => {
    fake().reset();
  });

  it("sends the Supabase bearer token when starting generation", async () => {
    fake().setUser({ id: "editor-1" });
    fake().queue("studies", { data: { workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "editor" } });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ jobId: "job-1" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const jobId = await startGeneration({ studyId: "study-1" });
    expect(jobId).toBe("job-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generation/start",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-access-token",
        },
      }),
    );
    vi.unstubAllGlobals();
  });

  it("builds JSON auth headers from the current session", async () => {
    fake().setUser({ id: "editor-1" });
    await expect(jsonAuthHeaders()).resolves.toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-access-token",
    });
  });
});
