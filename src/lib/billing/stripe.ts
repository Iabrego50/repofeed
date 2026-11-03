import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/schema";
import { requiredEnv } from "../server-env.js";
import { TRIAL_DAYS, teamSeats } from "./constants.js";
import { requireStripePriceId, requireStripeSecret, resolveStripePortalConfiguration } from "./prices.js";
export { syncPlanToDatabase } from "./sync-plan.js";

let stripe: Stripe | undefined;

export function getStripe(env: NodeJS.ProcessEnv = process.env): Stripe {
  if (!stripe) {
    stripe = new Stripe(requireStripeSecret(env), {
      apiVersion: "2026-09-30.endive",
    });
  }
  return stripe;
}

type WorkspaceClient = Pick<SupabaseClient, "from">;

async function resolveClient(client?: WorkspaceClient): Promise<WorkspaceClient> {
  if (client) return client;
  const { supabase } = await import("../../../api/_lib/supabase.js");
  return supabase;
}

export async function getOrCreateCustomer(
  workspaceId: string,
  client?: WorkspaceClient,
): Promise<string> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("workspaces")
    .select("customer_id, name, created_by")
    .eq("id", workspaceId)
    .single();

  if (error || !data) throw new Error("Workspace not found");
  if (data.customer_id) return data.customer_id;

  const { data: userData } = await supabase
    .from("users")
    .select("email")
    .eq("id", data.created_by)
    .single();

  const customer = await getStripe().customers.create({
    name: data.name,
    email: userData?.email || undefined,
    metadata: {
      workspace_id: workspaceId,
    },
  });

  await supabase
    .from("workspaces")
    .update({ customer_id: customer.id })
    .eq("id", workspaceId);

  return customer.id;
}

export async function createCheckoutSession(
  args: {
    workspaceId: string;
    plan: "pro" | "team";
    interval: "month" | "year";
    userId: string;
    successUrl: string;
    cancelUrl: string;
  },
  client?: WorkspaceClient,
): Promise<{ url: string | null }> {
  const supabase = await resolveClient(client);
  const customerId = await getOrCreateCustomer(args.workspaceId, supabase);

  const { count: editorCount } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", args.workspaceId)
    .in("role", ["owner", "editor"]);

  const quantity = args.plan === "team" ? teamSeats(editorCount || 1) : 1;
  const priceId = requireStripePriceId(args.plan, args.interval);

  const { data: userData } = await supabase
    .from("users")
    .select("trial_used_at")
    .eq("id", args.userId)
    .single();

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    subscription_data: checkoutSubscriptionData({
      trialUsed: Boolean(userData?.trial_used_at),
      workspaceId: args.workspaceId,
      plan: args.plan,
      interval: args.interval,
    }),
    metadata: {
      workspace_id: args.workspaceId,
      user_id: args.userId,
      plan: args.plan,
      interval: args.interval,
    },
  });

  await supabase
    .from("workspaces")
    .update({
      checkout_by: args.userId,
      billing_return_url: args.cancelUrl,
    })
    .eq("id", args.workspaceId);

  return { url: session.url };
}

export async function createPortalSession(
  args: {
    workspaceId: string;
    returnUrl: string;
  },
  client?: WorkspaceClient,
): Promise<{ url: string }> {
  const supabase = await resolveClient(client);
  const customerId = await getOrCreateCustomer(args.workspaceId, supabase);
  const session = await getStripe().billingPortal.sessions.create(
    portalSessionParams({ customerId, returnUrl: args.returnUrl }),
  );
  return { url: session.url };
}

export function checkoutSubscriptionData(args: {
  trialUsed: boolean;
  workspaceId: string;
  plan: "pro" | "team";
  interval: "month" | "year";
}): {
  metadata: { workspace_id: string; plan: string; interval: string };
  trial_period_days?: number;
} {
  const metadata = {
    workspace_id: args.workspaceId,
    plan: args.plan,
    interval: args.interval,
  };
  if (args.trialUsed) return { metadata };
  return { trial_period_days: TRIAL_DAYS, metadata };
}

export function portalSessionParams(
  args: { customerId: string; returnUrl: string },
  env: NodeJS.ProcessEnv = process.env,
): { customer: string; return_url: string; configuration?: string } {
  const params: { customer: string; return_url: string; configuration?: string } = {
    customer: args.customerId,
    return_url: args.returnUrl,
  };
  const configuration = resolveStripePortalConfiguration(env);
  if (configuration) params.configuration = configuration;
  return params;
}

export async function getPlanFromStripe(customerId: string): Promise<Plan> {
  if (!customerId) return "free";

  try {
    const subscriptions = await getStripe().subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) return "free";

    const subscription = subscriptions.data[0];
    const plan = subscription.metadata.plan as Plan | undefined;
    return plan || "free";
  } catch (error) {
    console.error("Error fetching plan from Stripe:", error);
    return "free";
  }
}

export { requiredEnv };
export { getStripe as stripe };
