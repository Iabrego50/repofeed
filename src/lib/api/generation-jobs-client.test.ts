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

import { cancelGeneration, getLatestJob, startGeneration } from "./generation-jobs";
import { jsonAuthHeaders } from "./bearer";
import { MAX_GENERATION_STEPS, STALE_JOB_FAIL_MESSAGE } from "./generation-guards";

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

  it("restores a published study when generation is cancelled", async () => {
    fake().setUser({ id: "editor-1" });
    fake().queue("studies", { data: { workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "editor" } });
    fake().queue("generation_jobs", { data: [{ id: "job-1" }] });
    fake().queue("studies", { data: { published_at: "2026-01-15T00:00:00Z" } });
    fake().queue("reels", { data: [], count: 2 });

    await cancelGeneration({ studyId: "study-1" });

    expect(fake().lastCall("generation_jobs", "update")?.payload).toEqual(
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(fake().lastCall("studies", "update")?.payload).toEqual(
      expect.objectContaining({ status: "published" }),
    );
  });

  it("re-triggers a stale running job from the status poll", async () => {
    fake().setUser({ id: "editor-1" });
    fake().queue("studies", { data: { workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "editor" } });
    fake().queue("generation_jobs", {
      data: {
        id: "job-1",
        study_id: "study-1",
        workspace_id: "ws-1",
        status: "running",
        phase: "compose",
        cursor: 0,
        chunks: [],
        log: [],
        error: null,
        attempts: 4,
        created_at: "2020-01-01T00:00:00.000Z",
        updated_at: "2020-01-01T00:00:00.000Z",
      },
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal("fetch", fetchMock);

    const job = await getLatestJob({ studyId: "study-1" });
    expect(job?.status).toBe("running");
    expect(fake().lastCall("generation_jobs", "update")?.payload).toEqual(
      expect.objectContaining({ updated_at: expect.any(String) }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/generation/process",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
    ));
    vi.unstubAllGlobals();
  });

  it("fails a stale job that already hit the step cap and restores the study", async () => {
    fake().setUser({ id: "editor-1" });
    fake().queue("studies", { data: { workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "editor" } });
    fake().queue("generation_jobs", {
      data: {
        id: "job-1",
        study_id: "study-1",
        workspace_id: "ws-1",
        status: "running",
        phase: "compose",
        cursor: 0,
        chunks: [],
        log: [],
        error: null,
        attempts: MAX_GENERATION_STEPS,
        created_at: "2020-01-01T00:00:00.000Z",
        updated_at: "2020-01-01T00:00:00.000Z",
      },
    });
    fake().queue("studies", { data: { published_at: "2026-01-15T00:00:00Z" } });
    fake().queue("reels", { data: [], count: 3 });

    const job = await getLatestJob({ studyId: "study-1" });
    expect(job?.status).toBe("failed");
    expect(job?.error).toBe(STALE_JOB_FAIL_MESSAGE);
    expect(fake().lastCall("generation_jobs", "update")?.payload).toEqual(
      expect.objectContaining({ status: "failed", error: STALE_JOB_FAIL_MESSAGE }),
    );
    expect(fake().lastCall("studies", "update")?.payload).toEqual(
      expect.objectContaining({ status: "published" }),
    );
  });
});
