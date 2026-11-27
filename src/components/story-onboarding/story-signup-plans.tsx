import { useState } from "react";
import { Link } from "react-router-dom";
import { IntervalToggle, PlanColumn } from "@/components/plan-grid.tsx";
import { LANDING_PATH } from "@/app-paths.ts";
import { PLANS, type Interval } from "@/lib/plans.ts";
import { setPendingPlan } from "@/lib/story-onboarding.ts";

/**
 * Pricing on the web story finish / sign-up step (Slopstrap-styled).
 * Same PLANS + Stripe pending-plan wiring as /landing and /billing.
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
    <div className="slop-card mt-8 space-y-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--slop-text-muted)] uppercase">Plans</p>
          <p className="mt-1 text-sm text-[var(--slop-text-muted)]">
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
                <button type="button" className="slop-btn slop-btn-primary h-10 w-full font-semibold" onClick={onStartFree}>
                  Start free
                </button>
              ) : (
                <button
                  type="button"
                  className={`slop-btn h-10 w-full font-semibold ${plan.highlight ? "slop-btn-primary" : "slop-btn-ghost"}`}
                  onClick={() => {
                    if (plan.id !== "pro" && plan.id !== "team") return;
                    setPendingPlan({ plan: plan.id, interval });
                    onStartPaid(plan.id, interval);
                  }}
                >
                  Start 14-day trial
                </button>
              )
            }
          />
        ))}
      </div>
      <p className="text-center text-sm text-[var(--slop-text-muted)]">
        Want the full pitch first?{" "}
        <Link to={LANDING_PATH} className="font-medium underline underline-offset-4">
          Learn more
        </Link>
      </p>
    </div>
  );
}
