import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/schema";

type WorkspaceClient = Pick<SupabaseClient, "from">;

async function resolveClient(client?: WorkspaceClient): Promise<WorkspaceClient> {
  if (client) return client;
  const { supabase } = await import("../supabase.js");
  return supabase;
}

export type PlanSyncUpdate = {
  paid_plan: string | null;
  lapsed_plan: string | null;
};

export function planSyncPayload(
  current: { paid_plan: string | null; lapsed_plan: string | null },
  plan: Plan,
): PlanSyncUpdate {
  const paid = plan === "free" ? null : plan;
  return {
    paid_plan: paid,
    lapsed_plan: paid ? null : current.paid_plan || current.lapsed_plan,
  };
}

export async function syncPlanToDatabase(
  workspaceId: string,
  plan: Plan,
  client?: WorkspaceClient,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { data } = await supabase
    .from("workspaces")
    .select("paid_plan, lapsed_plan, checkout_by")
    .eq("id", workspaceId)
    .single();

  if (!data) return;

  const updates = planSyncPayload(
    { paid_plan: data.paid_plan, lapsed_plan: data.lapsed_plan },
    plan,
  );

  await supabase.from("workspaces").update(updates).eq("id", workspaceId);

  if (updates.paid_plan && data.checkout_by) {
    const { data: userData } = await supabase
      .from("users")
      .select("trial_used_at")
      .eq("id", data.checkout_by)
      .single();

    if (userData && !userData.trial_used_at) {
      await supabase
        .from("users")
        .update({ trial_used_at: new Date().toISOString() })
        .eq("id", data.checkout_by);
    }
  }
}

export async function markPlanLapsed(
  workspaceId: string,
  plan: string | undefined,
  client?: WorkspaceClient,
): Promise<void> {
  const supabase = await resolveClient(client);
  await supabase
    .from("workspaces")
    .update({ lapsed_plan: plan ?? null })
    .eq("id", workspaceId);
}
