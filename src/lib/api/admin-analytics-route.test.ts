import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({
  fake: null as FakeSupabase | null,
}));

vi.mock("../../../api/_lib/supabase.js", async () => {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client, getServerSupabase: () => bag.fake!.client };
});

import handler from "../../../api/admin/analytics";

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
    send() {
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return { res, out };
}

function mockReq(
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): VercelRequest {
  return { method: "GET", body: {}, headers, query } as VercelRequest;
}

const ENV_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const snapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setApiEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    fake().reset();
    setApiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 404 when there is no bearer token", async () => {
    const { res, out } = mockRes();
    await handler(mockReq(), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(404);
    expect(out.body).toEqual({ error: "Not found" });
  });

  it("returns 404 for a signed-in user who is not admin", async () => {
    fake().setUser({ id: "member-1", email: "member@example.com" });
    fake().queue("users", { data: { is_admin: false } });
    const { res, out } = mockRes();
    await handler(
      mockReq({ authorization: "Bearer test-access-token" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(404);
    expect(out.body).toEqual({ error: "Not found" });
  });

  it("returns the snapshot for an admin", async () => {
    fake().setUser({ id: "admin-1", email: "admin@example.com" });
    fake().queue("users", { data: { is_admin: true } });
    const { res, out } = mockRes();
    await handler(
      mockReq({ authorization: "Bearer test-access-token" }, { range: "7d" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(200);
    expect(out.body).toEqual(
      expect.objectContaining({
        range: "7d",
        excludeInternal: true,
        headlines: expect.objectContaining({ users: 0 }),
      }),
    );
  });
});
