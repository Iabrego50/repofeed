import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePlan } from "@/hooks/use-plan";
import { getErrorMessage } from "@/lib/errors";
import { isBillingUnavailable } from "@/lib/billing/client";
import type { Interval } from "@/lib/plans";
import PlanGrid from "@/components/plan-grid";
import ConfirmChangeDialog from "./_components/confirm-change-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
    navigate("/");
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
        toast.error("Failed to create checkout session");
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
    <div className="container max-w-6xl py-8">
      <h1 className="text-3xl font-bold mb-2">Plan and billing</h1>
      <p className="text-muted-foreground mb-8">Manage your workspace subscription and billing details.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : unavailable ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Billing is coming soon</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Paid plans are not available to purchase yet. Your workspace stays on the Free plan until checkout is enabled.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Current usage</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-2xl font-bold">{currentUsage.studies}</div>
                <div className="text-sm text-muted-foreground">Active studies</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-2xl font-bold">{currentUsage.editors}</div>
                <div className="text-sm text-muted-foreground">Editors</div>
              </div>
            </div>
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
