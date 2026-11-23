import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AuthError, requireUser } from "../../_lib/auth.js";
import { sendJoinCodeEmail } from "../../_lib/emails.js";
import { requireSupabaseEnv, sendRouteError } from "../../_lib/respond.js";
import { supabase } from "../../_lib/supabase.js";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Editors/owners can email the current workspace join code to a teammate.
 * Membership is checked server-side with the service-role client.
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
    const body = (req.body ?? {}) as { workspaceId?: string; email?: string };
    const workspaceId = String(body.workspaceId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });
    if (!email || !isEmail(email)) return res.status(400).json({ error: "A valid email is required" });

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership || !["owner", "editor"].includes(membership.role)) {
      throw new AuthError(403, "Not authorized");
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, name, join_code")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspace?.join_code) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const senderName =
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
      user.email ||
      "A teammate";

    await sendJoinCodeEmail({
      to: email,
      workspaceName: workspace.name,
      joinCode: workspace.join_code,
      senderName,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendRouteError(res, error);
  }
}
