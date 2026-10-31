import { useState } from "react";
import { useAction, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Plan } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import PageHeader from "@/components/page-header.tsx";
import PlanGrid, { IntervalToggle } from "@/components/plan-grid.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { usePlan } from "@/hooks/use-plan.ts";
import { errorMessage } from "@/lib/errors.ts";
import { comparison, PLAN_LABEL, type Interval } from "@/lib/plans.ts";
import ConfirmChangeDialog, { type PendingChange } from "./_components/confirm-change-dialog.tsx";

const RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

function Usage({ plan }: { plan: Plan }) {
  const { current } = useWorkspace();
  const usage = useQuery(api.billing.data.usage, current ? { workspaceId: current._id } : "skip");
  const rows: { label: string; key?: "studies" | "editors"; limit: string }[] = [
    { label: "Active studies", key: "studies", limit: plan === "free" ? "3" : "Unlimited" },
    { label: "Editors", key: "editors", limit: plan === "team" ? "Unlimited" : "1" },
    { label: "Members and viewers", limit: "Unlimited" },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{r.label}</p>
          <div className="mt-2 font-display text-2xl font-bold">
            {!r.key ? (
              r.limit
            ) : usage === undefined ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                {usage[r.key]} <span className="text-base font-medium text-muted-foreground">/ {r.limit}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function BillingPage() {
  const { current, isOwner } = useWorkspace();
  const { plan, isError, refresh } = usePlan(current?._id);
  const usage = useQuery(api.billing.data.usage, current ? { workspaceId: current._id } : "skip");
  const checkout = useAction(api.billing.actions.checkout);
  const portal = useAction(api.billing.actions.billingPortal);
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState<Plan | "portal" | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);

  if (!current) return null;
  const trialAvailable = usage ? !usage.trialUsed : true;

  const startCheckout = async (target: "pro" | "team") => {
    setBusy(target);
    try {
      const res = await checkout({
        workspaceId: current._id,
        plan: target,
        interval,
        successUrl: `${window.location.origin}/billing?upgraded=1`,
        cancelUrl: window.location.href,
      });
      if (res.url) {
        window.open(res.url, "_blank", "noopener");
        toast.info("Checkout opened in a new tab. Your plan updates here when you're done.");
      } else if (res.updated) {
        toast.success("Your plan was updated");
        void refresh();
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't start checkout"));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  /** Free workspaces go to checkout; paid ones confirm first, since the saved card is charged at once. */
  const choose = (target: "pro" | "team") => {
    if (plan && plan !== "free") {
      setPending({ from: plan, to: target, interval, seats: Math.max(2, usage?.editors ?? 2) });
      return;
    }
    void startCheckout(target);
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      const { url } = await portal({ workspaceId: current._id, returnUrl: window.location.href });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't open billing"));
    } finally {
      setBusy(null);
    }
  };

  const action = (p: Plan) => {
    if (plan === undefined) return <Skeleton className="h-11 w-full" />;
    if (p === plan) {
      return (
        <Button variant="secondary" className="h-11 w-full" disabled>
          Your current plan
        </Button>
      );
    }
    if (!isOwner) {
      return <p className="text-center text-sm text-muted-foreground">Ask a workspace owner to change plans.</p>;
    }
    if (p === "free" || RANK[p] < RANK[plan]) {
      return (
        <Button variant="secondary" className="h-11 w-full" disabled={busy !== null} onClick={() => void openPortal()}>
          {busy === "portal" ? <Spinner /> : null} Downgrade in billing
        </Button>
      );
    }
    return (
      <Button className="h-11 w-full font-semibold" disabled={busy !== null} onClick={() => choose(p)}>
        {busy === p ? <Spinner /> : <Sparkles className="size-4" />}{" "}
        {plan === "free" ? (trialAvailable ? "Start 14-day trial" : `Upgrade to ${PLAN_LABEL[p]}`) : `Switch to ${PLAN_LABEL[p]}`}
      </Button>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-8 lg:py-12">
      <PageHeader
        eyebrow="Plan and billing"
        // Show the workspace name until the plan is known, so the headline never reads as stuck.
        title={plan ? `${current.name} is on ${PLAN_LABEL[plan]}` : current.name}
        description="Members who watch and discuss scenes are free on every plan. You only pay for editors."
        actions={
          isOwner && plan && plan !== "free" ? (
            <Button variant="secondary" className="h-11" disabled={busy !== null} onClick={() => void openPortal()}>
              {busy === "portal" ? <Spinner /> : <CreditCard className="size-4" />} Manage billing
            </Button>
          ) : undefined
        }
      />

      {isError ? (
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <AlertTriangle />
            </ErrorStateMedia>
            <ErrorStateTitle>Couldn't check your plan</ErrorStateTitle>
            <ErrorStateDescription>The payment service didn't respond. Try again in a moment.</ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" onClick={() => void refresh()}>Retry</Button>
          </ErrorStateContent>
        </ErrorState>
      ) : (
        <>
          <Usage plan={plan ?? "free"} />
          <div className="flex justify-center">
            <IntervalToggle value={interval} onChange={setInterval} />
          </div>
          <PlanGrid interval={interval} current={plan} renderAction={action} showTrial={trialAvailable} />
        </>
      )}

      <ConfirmChangeDialog
        change={pending}
        busy={busy !== null}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void startCheckout(pending.to)}
      />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">How we compare</h2>
        <p className="mt-1 text-sm text-muted-foreground">Public list prices per editor, per month, for research repository tools, as of October 2026. Check each provider for current pricing.</p>
        <ul className="mt-4 divide-y divide-border">
          {comparison(interval).map((c, i) => (
            <li key={c.name} className="flex items-center justify-between py-3 text-sm">
              <span className={i === 0 ? "font-semibold text-primary" : ""}>{c.name}</span>
              <span className="font-mono">{c.price}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
