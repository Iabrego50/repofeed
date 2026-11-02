import type { VercelResponse } from "@vercel/node";
import {
  isServerNotConfigured,
  requiredEnv,
  type ServerNotConfiguredError,
} from "../../src/lib/server-env.js";
import { isAuthError } from "./auth.js";
import { toStepError } from "../../src/lib/errors/step-error.js";

export { isServerNotConfigured, requiredEnv, ServerNotConfiguredError } from "../../src/lib/server-env.js";

export function requireSupabaseEnv() {
  requiredEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function sendNotConfigured(res: VercelResponse, error: ServerNotConfiguredError) {
  return res.status(503).json({ error: error.message });
}

export function sendRouteError(
  res: VercelResponse,
  error: unknown,
  fallback = "Internal server error",
) {
  if (isServerNotConfigured(error)) return sendNotConfigured(res, error);
  if (isAuthError(error)) return res.status(error.status).json({ error: error.message });
  if (error instanceof Error && error.name === "StepError") {
    const step = toStepError(error);
    if (step.detail.httpStatus) {
      return res.status(step.httpStatus).json({ error: step.message });
    }
  }
  const message = error instanceof Error ? error.message : fallback;
  return res.status(500).json({ error: message });
}

export function configJsonResponse(error: unknown): Response | null {
  if (!isServerNotConfigured(error)) return null;
  return new Response(JSON.stringify({ error: error.message }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}
