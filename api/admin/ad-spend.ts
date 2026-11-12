import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthError, requireAdmin } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Ad spend ledger behind /admin/analytics. Admin only: anyone else gets a 404,
 * the same as the analytics route, so the endpoint does not advertise itself.
 *   POST   { periodStart, periodEnd, source, medium?, campaign, amount, note? }
 *   DELETE ?id=<uuid>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  try {
    const user = await requireAdmin(req, supabase);
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "POST") {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const periodStart = text(body.periodStart, 10);
      const periodEnd = text(body.periodEnd, 10) || periodStart;
      const source = text(body.source, 120);
      const campaign = text(body.campaign, 200);
      const amount = Number(body.amount);
      if (!DAY.test(periodStart) || !DAY.test(periodEnd) || periodEnd < periodStart) {
        return res.status(400).json({ error: "Enter a start date and an end date on or after it." });
      }
      if (!source || !campaign) {
        return res.status(400).json({ error: "Source and campaign are required. Use the same names as your UTM tags." });
      }
      if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
        return res.status(400).json({ error: "Enter the amount spent as a number, for example 250.00." });
      }
      const { data, error } = await supabase
        .from("ad_spend")
        .insert({
          created_by: user.id,
          period_start: periodStart,
          period_end: periodEnd,
          source,
          medium: text(body.medium, 120) || null,
          campaign,
          amount_cents: Math.round(amount * 100),
          note: text(body.note, 500) || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return res.status(201).json({ id: data?.id });
    }

    if (req.method === "DELETE") {
      const id = text(Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id, 64);
      if (!id) return res.status(400).json({ error: "Missing id" });
      const { error } = await supabase.from("ad_spend").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (isAuthError(error) && error.status === 404) {
      return res.status(404).json({ error: "Not found" });
    }
    return sendRouteError(res, error);
  }
}
