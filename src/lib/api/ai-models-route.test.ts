import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const bag = vi.hoisted(() => ({
  models: [] as Array<{ id: string; created?: number }>,
  error: null as Error | null,
  calls: 0,
}));

vi.mock("../ai/client.js", () => ({
  getListedImageModels: async () => {
    bag.calls += 1;
    if (bag.error) throw bag.error;
    return bag.models;
  },
}));

import aiModelsHandler from "../../../api/admin/ai-models";

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

function mockReq(headers: Record<string, string> = {}, method = "GET"): VercelRequest {
  return { method, body: {}, headers } as VercelRequest;
}

const ENV_KEYS = ["OPENAI_API_KEY", "GENERATION_INTERNAL_SECRET"] as const;
const envSnapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setApiEnv() {
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.GENERATION_INTERNAL_SECRET = "internal-secret";
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (envSnapshot[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshot[key];
  }
}

describe("GET /api/admin/ai-models", () => {
  beforeEach(() => {
    bag.models = [];
    bag.error = null;
    bag.calls = 0;
    setApiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 503 when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const { res, out } = mockRes();
    await aiModelsHandler(mockReq(), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(503);
    expect(out.body).toEqual({ error: "Server not configured: OPENAI_API_KEY missing" });
    expect(bag.calls).toBe(0);
  });

  it("returns 405 for POST once the server is configured", async () => {
    const { res, out } = mockRes();
    await aiModelsHandler(mockReq({ "x-generation-internal-secret": "internal-secret" }, "POST"), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(405);
    expect(out.body).toEqual({ error: "Method not allowed" });
    expect(bag.calls).toBe(0);
  });

  it("returns 401 without the internal secret", async () => {
    const { res, out } = mockRes();
    await aiModelsHandler(mockReq(), res as unknown as VercelResponse);
    expect(out.statusCode).toBe(401);
    expect(out.body).toEqual({ error: "Unauthorized" });
    expect(bag.calls).toBe(0);
  });

  it("returns filtered image model ids only", async () => {
    bag.models = [
      { id: "gpt-image-1.5", created: 8 },
      { id: "dall-e-3", created: 2 },
    ];
    const { res, out } = mockRes();
    await aiModelsHandler(
      mockReq({ "x-generation-internal-secret": "internal-secret" }),
      res as unknown as VercelResponse,
    );
    expect(bag.calls).toBe(1);
    expect(out.statusCode).toBe(200);
    expect(out.body).toEqual({ models: ["gpt-image-1.5", "dall-e-3"] });
    expect(JSON.stringify(out.body)).not.toMatch(/sk-|secret|api[_-]?key/i);
  });
});
