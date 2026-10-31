import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { PLANS, PLAN_LABEL, formatPrice, type Interval } from "@/lib/plans.ts";
import type { Plan } from "@/schema/validators.ts";

export type PendingChange = { from: Plan; to: "pro" | "team"; interval: Interval; seats: number };

/** Total recurring charge for a plan, per billing period. */
function periodPrice(plan: "pro" | "team", interval: Interval, seats: number): number {
  const card = PLANS.find((p) => p.id === plan);
  const perMonth = card?.price[interval] ?? 0;
  const qty = plan === "team" ? seats : 1;
  return perMonth * qty * (interval === "year" ? 12 : 1);
}

/** Confirms a switch between paid plans, which charges the saved card right away. */
export default function ConfirmChangeDialog({
  change,
  busy,
  onCancel,
  onConfirm,
}: {
  change: PendingChange | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const total = change ? periodPrice(change.to, change.interval, change.seats) : 0;
  const per = change?.interval === "year" ? "year" : "month";
  return (
    <Dialog open={change !== null} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent>
        {change && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Switch to {PLAN_LABEL[change.to]}?</DialogTitle>
              <DialogDescription>Your saved card is used, so this takes effect as soon as you confirm.</DialogDescription>
            </DialogHeader>
            <dl className="space-y-3 rounded-xl border border-border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">New price</dt>
                <dd className="text-right font-semibold">
                  {formatPrice(total)} per {per}
                  {change.to === "team" && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {change.seats} editor seats (minimum 2). Seats follow your editor count.
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Charged today</dt>
                <dd className="max-w-[60%] text-right">
                  The difference for the rest of your current billing period, after credit for unused time on {PLAN_LABEL[change.from]}.
                </dd>
              </div>
              <p className="text-xs text-muted-foreground">Prices exclude applicable tax. Your receipt shows the exact amount.</p>
            </dl>
            <DialogFooter className="gap-2">
              <Button variant="ghost" className="h-11" disabled={busy} onClick={onCancel}>Cancel</Button>
              <Button className="h-11 font-semibold" disabled={busy} onClick={onConfirm}>
                {busy && <Spinner />} Confirm and pay
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
