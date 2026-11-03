import { afterEach, describe, expect, it } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import checkout from "../../../api/stripe/checkout";
import portal from "../../../api/stripe/portal";
import plan from "../../../api/billing/plan";

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const snapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
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
  return { res: res as unknown as VercelResponse, out };
}

afterEach(() => {
  restoreEnv();
});

describe("billing API routes", () => {
  it("returns a clean 503 when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    for (const handler of [checkout, portal, plan]) {
      const { res, out } = mockRes();
      await handler({ method: "POST", body: {}, headers: {}, query: {} } as VercelRequest, res);
      expect(out.statusCode).toBe(503);
      expect(out.body).toEqual({ error: "Server not configured: STRIPE_SECRET_KEY missing" });
    }
  });
});
