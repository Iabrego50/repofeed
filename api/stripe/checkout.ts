import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, requireWorkspaceOwner } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";
import { createCheckoutSession } from "../../src/lib/billing/stripe.js";
import { requireStripeSecret } from "../../src/lib/billing/prices.js";

function requireCheckoutEnv() {
  requireStripeSecret();
  requireSupabaseEnv();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireCheckoutEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const body = (req.body ?? {}) as {
      workspaceId?: string;
      plan?: string;
      interval?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    const workspaceId = String(body.workspaceId ?? "").trim();
    const plan = body.plan;
    const interval = body.interval;
    const successUrl = String(body.successUrl ?? "").trim();
    const cancelUrl = String(body.cancelUrl ?? "").trim();

    if (!workspaceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: "workspaceId, successUrl and cancelUrl are required" });
    }
    if (plan !== "pro" && plan !== "team") {
      return res.status(400).json({ error: "plan must be pro or team" });
    }
    if (interval !== "month" && interval !== "year") {
      return res.status(400).json({ error: "interval must be month or year" });
    }

    await requireWorkspaceOwner(user.id, workspaceId);
    const result = await createCheckoutSession(
      {
        workspaceId,
        plan,
        interval,
        userId: user.id,
        successUrl,
        cancelUrl,
      },
      supabase,
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRouteError(res, error);
  }
}
