import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, requireWorkspaceOwner } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { createPortalSession } from "../../src/lib/billing/stripe.js";
import { requireStripeSecret } from "../../src/lib/billing/prices.js";

function requirePortalEnv() {
  requireStripeSecret();
  requireSupabaseEnv();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requirePortalEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const body = (req.body ?? {}) as { workspaceId?: string; returnUrl?: string };
    const workspaceId = String(body.workspaceId ?? "").trim();
    const returnUrl = String(body.returnUrl ?? "").trim();

    if (!workspaceId || !returnUrl) {
      return res.status(400).json({ error: "workspaceId and returnUrl are required" });
    }

    await requireWorkspaceOwner(user.id, workspaceId);
    const result = await createPortalSession({ workspaceId, returnUrl }, supabase);
    return res.status(200).json(result);
  } catch (error) {
    return sendRouteError(res, error);
  }
}
