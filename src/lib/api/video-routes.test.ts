import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({
  fake: null as FakeSupabase | null,
  enqueue: vi.fn(async (..._args: unknown[]) => undefined),
  process: vi.fn(async (..._args: unknown[]) => ({
    started: 0,
    polled: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  })),
}));

vi.mock("../../../api/_lib/supabase.js", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  bag.fake = createFakeSupabase();
  return {
    supabase: bag.fake.client,
    getServerSupabase: () => bag.fake!.client,
    supabaseUrl: () => "https://example.supabase.co",
  };
});

vi.mock("../../../api/_lib/video-chain.js", () => ({
  dispatchVideoProcess: (args?: unknown) => bag.enqueue(args),
}));

vi.mock("./reel-video-jobs.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reel-video-jobs")>();
  return {
    ...actual,
    processReelVideos: (store: unknown, provider: unknown, args?: unknown) =>
      bag.process(store, provider, args),
    enqueueReelVideos: vi.fn(async () => ({ queued: 1, skipped: 0 })),
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

function mockReq(
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
): VercelRequest {
  return { method, body, headers } as VercelRequest;
}

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "XAI_API_KEY",
  "GENERATION_INTERNAL_SECRET",
] as const;
const envSnapshot = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function setApiEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.XAI_API_KEY = "xai-test";
  process.env.GENERATION_INTERNAL_SECRET = "internal-secret";
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (envSnapshot[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshot[key];
  }
}

import processHandler from "../../../api/videos/process";
import backfillHandler from "../../../api/videos/backfill";

describe("video API auth", () => {
  beforeEach(() => {
    fake().reset();
    bag.enqueue.mockClear();
    bag.process.mockClear();
    setApiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("process returns 401 without a bearer token or internal secret", async () => {
    const { res, out } = mockRes();
    await processHandler(
      mockReq({ studyId: "study-1" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(401);
  });

  it("process allows an internal secret", async () => {
    const { res, out } = mockRes();
    await processHandler(
      mockReq(
        { studyId: "study-1" },
        { "x-generation-internal-secret": "internal-secret" },
      ),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(202);
    expect(out.body).toEqual(expect.objectContaining({ accepted: true }));
    expect(bag.process).toHaveBeenCalled();
  });

  it("backfill requires a study for signed-in editors and then dispatches process", async () => {
    fake().setUser({ id: "editor-1" });
    fake().queue("studies", { data: { workspace_id: "ws-1" } });
    fake().queue("workspace_members", { data: { role: "editor" } });

    const { res, out } = mockRes();
    await backfillHandler(
      mockReq(
        { studyId: "study-1" },
        { authorization: "Bearer test-access-token" },
      ),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(202);
    expect(out.body).toEqual(
      expect.objectContaining({ accepted: true, queued: 1 }),
    );
    expect(bag.enqueue).toHaveBeenCalled();
  });
});
