import type { VercelResponse } from "@vercel/node";
import {
  isServerNotConfigured,
  requiredEnv,
  type ServerNotConfiguredError,
} from "../../src/lib/server-env.js";

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
