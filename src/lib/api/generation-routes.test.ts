import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({
  fake: null as FakeSupabase | null,
  enqueue: vi.fn(async (_jobId: string) => undefined),
}));

vi.mock("../../../api/_lib/supabase.js", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client, getServerSupabase: () => bag.fake!.client };
});

vi.mock("../../../api/_lib/generation-chain.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/_lib/generation-chain")>();
  return {
    ...actual,
    dispatchGenerationProcess: (jobId: string) => bag.enqueue(jobId),
    enqueueGenerationProcess: (jobId: string) => bag.enqueue(jobId),
    registerProcessRunner: () => undefined,
  };
});

function fake(): FakeSupabase {
  if (!bag.fake) throw new Error("fake supabase not initialized");
  return bag.fake;
}

function mockRes() {
  const out = { statusCode: 200, body: null as unknown };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
    send(body: unknown) {
      out.body = typeof body === "string" ? JSON.parse(body as string) : body;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return { res, out };
}

function mockReq(body: unknown, headers: Record<string, string> = {}): VercelRequest {
  return { method: "POST", body, headers } as VercelRequest;
}

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GENERATION_INTERNAL_SECRET",
] as const;

const envSnapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setApiEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.GENERATION_INTERNAL_SECRET = "internal-secret";
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (envSnapshot[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshot[key];
  }
}

import startHandler from "../../../api/generation/start";
import processHandler, { maxDuration } from "../../../api/generation/process";
import paintHandler from "../../../api/art/paint";

describe("generation and paint API auth", () => {
  beforeEach(() => {
    fake().reset();
    bag.enqueue.mockClear();
    setApiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("start returns 401 without a bearer token", async () => {
    const { res, out } = mockRes();
    await startHandler(mockReq({ studyId: "study-1" }), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(401);
    expect(out.body).toEqual({ error: "Unauthorized" });
  });

  it("start returns 403 when the user cannot edit the workspace", async () => {
    fake().setUser({ id: "member-1" });
    fake().queue("users", { data: { id: "member-1" } });
    fake().queue("studies", { data: { id: "study-1", workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "member" } });

    const { res, out } = mockRes();
    await startHandler(
      mockReq({ studyId: "study-1" }, { authorization: "Bearer test-access-token" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(403);
    expect(out.body).toEqual({ error: "Forbidden" });
  });

  it("start sets started_by to the authenticated editor", async () => {
    fake().setUser({ id: "editor-1" });
    fake().queue("users", { data: { id: "editor-1" } });
    fake().queue("studies", { data: { id: "study-1", workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "editor" } });
    fake().queue("sources", {
      data: [{ id: "src-1", name: "notes.md", text: "hello world", chars: 11 }],
    });
    fake().queue("generation_jobs", { data: { id: "job-1" } });

    const { res, out } = mockRes();
    await startHandler(
      mockReq({ studyId: "study-1" }, { authorization: "Bearer test-access-token" }),
      res as unknown as VercelResponse,
    );

    expect(out.statusCode).toBe(200);
    expect(out.body).toEqual({ jobId: "job-1", status: "queued" });
    const inserted = fake().lastCall("generation_jobs", "insert")?.payload as { started_by?: string };
    expect(inserted.started_by).toBe("editor-1");
    expect(bag.enqueue).toHaveBeenCalledWith("job-1");
  });

  it("process returns 401 without a bearer token or internal secret", async () => {
    const { res, out } = mockRes();
    await processHandler(mockReq({ jobId: "job-1" }), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(401);
    expect(out.body).toEqual({ error: "Unauthorized" });
  });

  it("process returns 403 when the caller is not a workspace editor", async () => {
    fake().setUser({ id: "member-1" });
    fake().queue("generation_jobs", {
      data: { id: "job-1", workspace_id: "ws-1", study_id: "study-1", phase: "verify" },
    });
    fake().queue("workspace_members", { data: { role: "member" } });

    const { res, out } = mockRes();
    await processHandler(
      mockReq({ jobId: "job-1" }, { authorization: "Bearer test-access-token" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(403);
    expect(out.body).toEqual({ error: "Forbidden" });
  });

  it("process allows an internal secret without a user session", async () => {
    const job = {
      id: "job-1",
      workspace_id: "ws-1",
      study_id: "study-1",
      phase: "verify",
      status: "running",
      attempts: 1,
      updated_at: new Date().toISOString(),
      locked_until: new Date(0).toISOString(),
    };
    fake().queue("generation_jobs", { data: job });
    fake().queue("generation_jobs", { data: job });
    fake().queue("generation_jobs", { data: job });
    fake().queue("studies", { data: { id: "study-1", title: "Study", audience: "PMs", goal: "" } });

    const { res, out } = mockRes();
    await processHandler(
      mockReq({ jobId: "job-1" }, { "x-generation-internal-secret": "internal-secret" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(202);
    expect(out.body).toEqual({
      accepted: true,
      jobId: "job-1",
      phase: "verify",
      status: "running",
    });
    expect(fake().lastCall("studies", "update")?.payload).toEqual(
      expect.objectContaining({ status: "review" }),
    );
  });

  it("marks the job failed with a message and restores study status when a step throws", async () => {
    const runningJob = {
      id: "job-1",
      workspace_id: "ws-1",
      study_id: "study-1",
      phase: "compose",
      status: "running",
      attempts: 4,
      updated_at: new Date().toISOString(),
    };
    fake().queue("generation_jobs", { data: runningJob });
    fake().queue("generation_jobs", { data: runningJob });
    fake().queue("generation_jobs", { data: runningJob });
    fake().queue("studies", { data: null, error: { message: "No rows found" } });
    fake().queue("generation_jobs", { data: { study_id: "study-1" } });
    fake().queue("studies", { data: { published_at: "2026-01-15T00:00:00Z" } });
    fake().queue("reels", { data: [], count: 1 });

    const { res, out } = mockRes();
    await processHandler(
      mockReq({ jobId: "job-1" }, { "x-generation-internal-secret": "internal-secret" }),
      res as unknown as VercelResponse,
    );

    expect(out.statusCode).toBe(202);
    expect(out.body).toEqual(
      expect.objectContaining({
        accepted: true,
        jobId: "job-1",
      }),
    );
    const failUpdate = fake()
      .callsFor("generation_jobs", "update")
      .find((call) => (call.payload as { status?: string }).status === "failed");
    expect(failUpdate?.payload).toEqual(
      expect.objectContaining({
        status: "failed",
        error: "Study was deleted",
      }),
    );
    expect(fake().lastCall("studies", "update")?.payload).toEqual(
      expect.objectContaining({ status: "published" }),
    );
  });

  it("exports a 300s maxDuration for the process function", () => {
    expect(maxDuration).toBe(300);
  });

  it("paint returns 401 without a bearer token", async () => {
    const { res, out } = mockRes();
    await paintHandler(mockReq({ reelId: "reel-1" }), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(401);
    expect(out.body).toEqual({ error: "Unauthorized" });
  });

  it("paint returns 403 when the user cannot edit the reel workspace", async () => {
    fake().setUser({ id: "member-1" });
    fake().queue("reels", {
      data: { id: "reel-1", workspace_id: "ws-1", title: "Reel", track: "t", scenes: [] },
    });
    fake().queue("workspace_members", { data: { role: "member" } });

    const { res, out } = mockRes();
    await paintHandler(
      mockReq({ reelId: "reel-1" }, { authorization: "Bearer test-access-token" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(403);
    expect(out.body).toEqual({ error: "Forbidden" });
  });
});
