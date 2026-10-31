import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { usePlan } from "@/hooks/use-plan.ts";
import { getErrorMessage } from "@/lib/errors.ts";
import { api } from "@/lib/api";

const PLAN_LABEL = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
};

function Banner({ icon, children, actions }: { icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-3 border-b border-[#FFC23D]/40 bg-[#FFC23D]/10 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <span className="flex flex-1 items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[#FFC23D]">{icon}</span>
        <span>{children}</span>
      </span>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

/** Owner-facing notices: a paid plan ended (cancelled or payment failed), or editors are over the plan's seats. */
function OwnerNotices() {
  const { current } = useWorkspace();
  const [usage, setUsage] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) return;
    
    api.billing.data.usage({ workspaceId: current._id })
      .then(setUsage)
      .catch((err) => console.error('Failed to load usage:', err));
  }, [current]);

  if (!current || !usage) return null;

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await api.billing.portal({
        workspaceId: current._id,
        returnUrl: window.location.href,
      });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {usage.lapsedPlan && (
        <Banner
          icon={<AlertTriangle className="size-4" />}
          actions={
            <>
              <Button size="sm" className="h-9" disabled={busy} onClick={() => void openPortal()}>
                {busy ? <Spinner /> : <CreditCard className="size-4" />} Update card
              </Button>
            </>
          }
        >
          <strong>Your {PLAN_LABEL[usage.lapsedPlan as keyof typeof PLAN_LABEL]} plan has ended.</strong> This usually means the last payment didn't go through, or the plan was cancelled. Update your card to restore {PLAN_LABEL[usage.lapsedPlan as keyof typeof PLAN_LABEL]} features.
        </Banner>
      )}
      {usage.seatOverage && (
        <Banner
          icon={<UserX className="size-4" />}
          actions={
            <Button asChild size="sm" variant="secondary" className="h-9">
              <Link to="/billing">See plans</Link>
            </Button>
          }
        >
          This workspace has {usage.editors} editors, but its plan includes 1. Owners can still edit; other editors can only watch and comment until you upgrade to Team or change their role. Nobody has been removed.
        </Banner>
      )}
    </>
  );
}

/** Keeps the plan check fresh across the app and shows billing notices. */
export default function PlanNotices() {
  const { current, isOwner } = useWorkspace();
  usePlan();
  
  if (!current) return null;
  
  return isOwner ? <OwnerNotices /> : null;
}
