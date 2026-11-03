import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { requireStripeSecret } from "../../src/lib/billing/prices.js";

function requirePlanEnv() {
  requireStripeSecret();
  requireSupabaseEnv();
}

function readWorkspaceId(req: VercelRequest): string {
  const query = req.query?.workspaceId;
  if (typeof query === "string" && query.trim()) return query.trim();
  if (Array.isArray(query) && query[0]) return String(query[0]).trim();
  const body = (req.body ?? {}) as { workspaceId?: string };
  return String(body.workspaceId ?? "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requirePlanEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const workspaceId = readWorkspaceId(req);
    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data } = await supabase
      .from("workspaces")
      .select("paid_plan, seat_variant")
      .eq("id", workspaceId)
      .maybeSingle();

    const plan = data?.paid_plan === "pro" || data?.paid_plan === "team" ? data.paid_plan : "free";
    return res.status(200).json({ plan, variant: data?.seat_variant ?? null });
  } catch (error) {
    return sendRouteError(res, error);
  }
}
