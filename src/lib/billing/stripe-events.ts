import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/schema";
import { markPlanLapsed, syncPlanToDatabase } from "./sync-plan.js";

export type StripeLikeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

export type StripeSubscriptionLike = {
  retrieve: (id: string) => Promise<{ metadata?: { workspace_id?: string; plan?: string } }>;
};

function asPlan(value: unknown): Plan | undefined {
  if (value === "pro" || value === "team" || value === "free") return value;
  return undefined;
}

const PAID_STATUSES = new Set(["active", "trialing"]);

function subscriptionIdFromInvoice(invoice: Record<string, unknown>): string | undefined {
  const direct = invoice.subscription;
  if (typeof direct === "string" && direct) return direct;
  if (direct && typeof direct === "object" && "id" in direct) {
    const id = (direct as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === "string" && nested) return nested;
  if (nested && typeof nested === "object" && "id" in nested) {
    const id = (nested as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return undefined;
}

export async function handleStripeEvent(
  event: StripeLikeEvent,
  stripe?: StripeSubscriptionLike,
  client?: SupabaseClient,
): Promise<"ok" | "ignored"> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const metadata = (session.metadata ?? {}) as { workspace_id?: string; plan?: string };
      const plan = asPlan(metadata.plan);
      if (metadata.workspace_id && plan && plan !== "free") {
        await syncPlanToDatabase(metadata.workspace_id, plan, client);
        return "ok";
      }
      return "ignored";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const metadata = (subscription.metadata ?? {}) as { workspace_id?: string; plan?: string };
      const plan = asPlan(metadata.plan);
      if (metadata.workspace_id && plan && plan !== "free" && PAID_STATUSES.has(String(subscription.status))) {
        await syncPlanToDatabase(metadata.workspace_id, plan, client);
        return "ok";
      }
      return "ignored";
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const metadata = (subscription.metadata ?? {}) as { workspace_id?: string };
      if (metadata.workspace_id) {
        await syncPlanToDatabase(metadata.workspace_id, "free", client);
        return "ok";
      }
      return "ignored";
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (subscriptionId && stripe) {
        const sub = await stripe.retrieve(subscriptionId);
        if (sub.metadata?.workspace_id) {
          await markPlanLapsed(sub.metadata.workspace_id, sub.metadata.plan, client);
          return "ok";
        }
      }
      return "ignored";
    }
    default:
      return "ignored";
  }
}
