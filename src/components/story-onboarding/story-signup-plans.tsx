import { useState } from "react";
import { Link } from "react-router-dom";
import { IntervalToggle, PlanColumn } from "@/components/plan-grid.tsx";
import { Button } from "@/components/ui/button.tsx";
import { LANDING_PATH } from "@/app-paths.ts";
import { PLANS, type Interval } from "@/lib/plans.ts";
import { setPendingPlan } from "@/lib/story-onboarding.ts";

/**
 * Pricing shown on the web story finish / sign-up step.
 * Uses the same `PLANS` + `PlanColumn` as /landing and /billing.
 * Paid selections stash a pending plan for Stripe checkout after workspace setup.
 */
export default function StorySignupPlans({
  onStartFree,
  onStartPaid,
}: {
  onStartFree: () => void;
  onStartPaid: (plan: "pro" | "team", interval: Interval) => void;
}) {
  const [interval, setInterval] = useState<Interval>("year");

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Plans</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay for editors. Viewers are free. Same prices as on the site.
          </p>
        </div>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanColumn
            key={plan.id}
            plan={plan}
            interval={interval}
            action={
              plan.id === "free" ? (
                <Button type="button" className="h-10 w-full font-semibold" onClick={onStartFree}>
                  Start free
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={plan.highlight ? "default" : "outline"}
                  className="h-10 w-full font-semibold"
                  onClick={() => {
                    if (plan.id !== "pro" && plan.id !== "team") return;
                    setPendingPlan({ plan: plan.id, interval });
                    onStartPaid(plan.id, interval);
                  }}
                >
                  Start 14-day trial
                </Button>
              )
            }
          />
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Want the full pitch first?{" "}
        <Link to={LANDING_PATH} className="font-medium text-foreground underline underline-offset-4">
          Learn more
        </Link>
      </p>
    </div>
  );
}
