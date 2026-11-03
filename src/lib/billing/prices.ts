import { ServerNotConfiguredError } from "../server-env.js";

export type PaidPlan = "pro" | "team";
export type BillingInterval = "month" | "year";

const PRICE_ENV: Record<PaidPlan, Record<BillingInterval, readonly string[]>> = {
  pro: {
    month: ["STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO"],
    year: ["STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRICE_PRO"],
  },
  team: {
    month: ["STRIPE_PRICE_TEAM_MONTHLY", "STRIPE_PRICE_TEAM"],
    year: ["STRIPE_PRICE_TEAM_YEARLY", "STRIPE_PRICE_TEAM"],
  },
};

export function stripePriceEnvNames(plan: PaidPlan, interval: BillingInterval): readonly string[] {
  return PRICE_ENV[plan][interval];
}

export function resolveStripePriceId(
  plan: PaidPlan,
  interval: BillingInterval,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const name of stripePriceEnvNames(plan, interval)) {
    const value = String(env[name] ?? "").trim();
    if (value) return value;
  }
  return undefined;
}

export function requireStripePriceId(
  plan: PaidPlan,
  interval: BillingInterval,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const priceId = resolveStripePriceId(plan, interval, env);
  if (!priceId) {
    throw new ServerNotConfiguredError(stripePriceEnvNames(plan, interval)[0]);
  }
  return priceId;
}

export function isStripeSecretConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(String(env.STRIPE_SECRET_KEY ?? "").trim());
}

export function requireStripeSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.STRIPE_SECRET_KEY ?? "").trim();
  if (!value) throw new ServerNotConfiguredError("STRIPE_SECRET_KEY");
  return value;
}

/** Optional Customer Portal configuration id for a shared Stripe account. */
export function resolveStripePortalConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = String(env.STRIPE_PORTAL_CONFIGURATION ?? "").trim();
  return value || undefined;
}
