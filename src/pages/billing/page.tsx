import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePlan } from "@/hooks/use-plan";
import { getErrorMessage } from "@/lib/errors";
import { isBillingUnavailable } from "@/lib/billing/client";
import type { Interval } from "@/lib/plans";
import PageHeader from "@/components/page-header.tsx";
import PlanGrid from "@/components/plan-grid";
import ConfirmChangeDialog from "./_components/confirm-change-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { track } from "@/lib/analytics";

export default function BillingPage() {
  const navigate = useNavigate();
  const { current, isOwner } = useWorkspace();
  const { plan, loading: planLoading, unavailable } = usePlan();
  const [usage, setUsage] = useState<{
    studies: number;
    editors: number;
    trialUsed?: boolean;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [confirmPlan, setConfirmPlan] = useState<{ plan: "pro" | "team"; interval: Interval } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!current) return;

    api.billing.data
      .usage({ workspaceId: current._id })
      .then((data) => {
        setUsage(data);
        setLoadingUsage(false);
      })
      .catch((err) => {
        console.error("Failed to load usage:", err);
        toast.error(getErrorMessage(err));
        setLoadingUsage(false);
      });
  }, [current]);

  if (!current) {
    navigate("/feed");
    return null;
  }

  if (!isOwner) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Only workspace owners can manage billing.</p>
      </div>
    );
  }

  const loading = planLoading || loadingUsage;

  const currentUsage = usage
    ? {
        studies: usage.studies,
        editors: usage.editors,
      }
    : { studies: 0, editors: 0 };

  const handlePlanSelect = (selectedPlan: "pro" | "team", interval: Interval) => {
    if (unavailable) {
      toast.error("Billing is coming soon");
      return;
    }
    setConfirmPlan({ plan: selectedPlan, interval });
  };

  const handleConfirmCheckout = async () => {
    if (!confirmPlan) return;

    setCheckoutLoading(true);
    track("checkout_started", {
      workspaceId: current._id,
      plan: confirmPlan.plan,
      interval: confirmPlan.interval,
    });
    try {
      const { url } = await api.billing.checkout({
        workspaceId: current._id,
        plan: confirmPlan.plan,
        interval: confirmPlan.interval,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing`,
      });

      if (url) {
        window.location.href = url;
      } else {
        toast.error("Checkout didn’t open. Try again in a moment.");
        setCheckoutLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(isBillingUnavailable(err) ? "Billing is coming soon" : getErrorMessage(err));
      setCheckoutLoading(false);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await api.billing.portal({
        workspaceId: current._id,
        returnUrl: window.location.href,
      });
      window.location.href = url;
    } catch (err) {
      console.error("Portal error:", err);
      toast.error(isBillingUnavailable(err) ? "Billing is coming soon" : getErrorMessage(err));
      setPortalLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:py-12">
      <PageHeader
        eyebrow={current.name}
        title="Plan and billing"
        description="You pay for the people who make studies. Everyone who watches is free."
      />
      <div className="mt-8" />

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : unavailable ? (
        <div className="rounded-xl border border-border bg-card p-8">
          <h2 className="text-xl font-bold">Billing is coming soon</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Paid plans aren’t on sale yet. Your workspace stays on Free, with everything Free includes, until checkout opens.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="sr-only">What this workspace uses today</h2>
            <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <dt className="text-sm text-muted-foreground">Active studies</dt>
                <dd className="text-2xl font-bold">{currentUsage.studies}</dd>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <dt className="text-sm text-muted-foreground">Editors</dt>
                <dd className="text-2xl font-bold">{currentUsage.editors}</dd>
              </div>
            </dl>
          </div>

          <PlanGrid
            currentPlan={plan}
            onSelect={handlePlanSelect}
            usage={currentUsage}
            trialAvailable={!usage?.trialUsed}
          />

          {plan !== "free" && (
            <div className="mt-8 text-center">
              <Button onClick={() => void openPortal()} disabled={portalLoading}>
                {portalLoading ? <Spinner /> : "Manage subscription"}
              </Button>
            </div>
          )}
        </>
      )}

      {confirmPlan && (
        <ConfirmChangeDialog
          open={!!confirmPlan}
          onClose={() => setConfirmPlan(null)}
          onConfirm={handleConfirmCheckout}
          plan={confirmPlan.plan}
          interval={confirmPlan.interval}
          currentPlan={plan}
          loading={checkoutLoading}
        />
      )}
    </div>
  );
}
