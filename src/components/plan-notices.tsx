import { useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { AlertTriangle, CreditCard, UserX, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { usePlan } from "@/hooks/use-plan.ts";
import { errorMessage } from "@/lib/errors.ts";
import { PLAN_LABEL } from "@/lib/plans.ts";

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
  const usage = useQuery(api.billing.data.usage, current ? { workspaceId: current._id } : "skip");
  const portal = useAction(api.billing.actions.billingPortal);
  const dismiss = useMutation(api.billing.data.dismissLapse);
  const [busy, setBusy] = useState(false);
  if (!current || !usage) return null;

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await portal({ workspaceId: current._id, returnUrl: window.location.href });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't open billing"));
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
              <Button size="icon" variant="ghost" className="size-9" aria-label="Dismiss" onClick={() => void dismiss({ workspaceId: current._id })}>
                <X className="size-4" />
              </Button>
            </>
          }
        >
          <strong>Your {PLAN_LABEL[usage.lapsedPlan]} plan has ended.</strong> This usually means the last payment didn't go through, or the plan was cancelled. Update your card to restore {PLAN_LABEL[usage.lapsedPlan]} features.
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
  // Each check also records plan changes (lapses, seat limits) on the server.
  usePlan(current && current.role !== "member" ? current._id : undefined);
  if (!current) return null;
  if (current.seatPaused) {
    return (
      <Banner icon={<UserX className="size-4" />}>
        Editing is paused in {current.name}: its plan has fewer editor seats than editors. You can still watch and comment. Ask an owner to upgrade to Team.
      </Banner>
    );
  }
  return isOwner ? <OwnerNotices /> : null;
}
