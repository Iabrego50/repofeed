import { jsonAuthHeaders } from "../api/bearer";
import type { Plan } from "@/schema/validators";

export class BillingUnavailableError extends Error {
  readonly status = 503;

  constructor(message = "Billing is coming soon") {
    super(message);
    this.name = "BillingUnavailableError";
  }
}

export function isBillingUnavailable(error: unknown): error is BillingUnavailableError {
  return (
    error instanceof BillingUnavailableError ||
    (error instanceof Error && (error.name === "BillingUnavailableError" || error.message === "Billing is coming soon"))
  );
}

async function parseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || response.statusText || "Billing request failed";
}

async function billingFetch<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 503) {
    throw new BillingUnavailableError();
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

export async function checkout(args: {
  workspaceId: string;
  plan: "pro" | "team";
  interval: "month" | "year";
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null }> {
  return billingFetch("/api/stripe/checkout", {
    method: "POST",
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(args),
  });
}

export async function portal(args: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  return billingFetch("/api/stripe/portal", {
    method: "POST",
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(args),
  });
}

export async function getRemotePlan(args: { workspaceId: string }): Promise<{
  plan: Plan;
  variant?: string | null;
}> {
  const params = new URLSearchParams({ workspaceId: args.workspaceId });
  return billingFetch(`/api/billing/plan?${params}`, {
    method: "GET",
    headers: await jsonAuthHeaders(),
  });
}
