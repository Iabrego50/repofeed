import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../_lib/auth.js";
import { requireSupabaseEnv, sendRouteError } from "../_lib/respond.js";
import { supabase } from "../_lib/supabase.js";

/**
 * Permanently deletes the signed-in user's auth account.
 * App data cascades via public.users → auth.users ON DELETE CASCADE.
 * Companion RPC: public.delete_own_account() (see supabase/migrations).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const confirm = String((req.body as { confirm?: string } | null)?.confirm ?? "").trim();
    if (confirm !== "DELETE") {
      return res.status(400).json({ error: 'Send { "confirm": "DELETE" } to confirm account deletion' });
    }

    const { error: adminError } = await supabase.auth.admin.deleteUser(user.id);
    if (adminError) {
      throw new Error(adminError.message || "Could not delete account");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendRouteError(res, error);
  }
}
