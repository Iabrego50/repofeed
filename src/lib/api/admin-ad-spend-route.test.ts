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

import handler from "../../../api/admin/ad-spend";

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
  method: string,
  headers: Record<string, string> = {},
  body: Record<string, unknown> = {},
  query: Record<string, string> = {},
): VercelRequest {
  return { method, body, headers, query } as VercelRequest;
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

describe("/api/admin/ad-spend", () => {
  beforeEach(() => {
    fake().reset();
    setApiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 404 when there is no bearer token", async () => {
    const { res, out } = mockRes();
    await handler(mockReq("POST"), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(404);
    expect(out.body).toEqual({ error: "Not found" });
  });

  it("returns 404 for a signed-in user who is not admin", async () => {
    fake().setUser({ id: "member-1", email: "member@example.com" });
    fake().queue("users", { data: { is_admin: false } });
    const { res, out } = mockRes();
    await handler(
      mockReq("POST", { authorization: "Bearer test-access-token" }),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(404);
    expect(out.body).toEqual({ error: "Not found" });
  });

  it("lets an admin log spend", async () => {
    fake().setUser({ id: "admin-1", email: "admin@example.com" });
    fake().queue("users", { data: { is_admin: true } });
    fake().queue("ad_spend", { data: { id: "sp-1" } });
    const { res, out } = mockRes();
    await handler(
      mockReq(
        "POST",
        { authorization: "Bearer test-access-token" },
        {
          periodStart: "2026-11-01",
          periodEnd: "2026-11-07",
          source: "google",
          campaign: "repository-search",
          amount: 250,
        },
      ),
      res as unknown as VercelResponse,
    );
    expect(out.statusCode).toBe(201);
    expect(out.body).toEqual({ id: "sp-1" });
  });
});
