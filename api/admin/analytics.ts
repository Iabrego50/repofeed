import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthError, requireAdmin } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import {
  loadAdminAnalytics,
  parseAdminAnalyticsQuery,
} from "../../src/lib/api/admin-analytics.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdmin(req, supabase);
    const query = parseAdminAnalyticsQuery({
      range: req.query?.range as string | string[] | undefined,
      excludeInternal: req.query?.excludeInternal as string | string[] | undefined,
    });
    const snapshot = await loadAdminAnalytics(supabase, query);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(snapshot);
  } catch (error) {
    if (isAuthError(error) && error.status === 404) {
      return res.status(404).json({ error: "Not found" });
    }
    return sendRouteError(res, error);
  }
}
