import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils.ts";
import type { Plan } from "@/schema/validators";
import { PLANS, formatPrice, type Interval, type PlanCard } from "@/lib/plans.ts";

/** One plan column. Shared by the public pricing section and the in-app billing page so the two never drift. */
export function PlanColumn({ plan, interval, action, note }: { plan: PlanCard; interval: Interval; action: ReactNode; note?: string }) {
  const yearlySaving = (plan.price.month - plan.price.year) * 12;
  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-6", plan.highlight ? "border-foreground shadow-lift" : "border-border")}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold">{plan.name}</h3>
        {plan.highlight && <span className="rounded bg-mark px-1.5 py-0.5 text-xs font-semibold text-mark-foreground">Recommended</span>}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{plan.tagline}</p>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight">{formatPrice(plan.price[interval])}</span>
        <span className="text-sm text-muted-foreground">{plan.id === "free" ? "forever" : plan.unit}</span>
      </p>
      <p className="mt-1 min-h-5 text-sm text-muted-foreground">
        {plan.id === "free" ? "No card needed" : interval === "year" && yearlySaving > 0 ? `Billed yearly. You save $${yearlySaving.toFixed(0)} a year.` : "Billed monthly"}
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[0.9375rem]">
            <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">{action}</div>
      {note && <p className="mt-2 text-center text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function PlanGrid({
  currentPlan,
  onSelect,
  trialAvailable,
  interval: controlledInterval,
  onIntervalChange,
}: {
  currentPlan: Plan;
  onSelect: (plan: "pro" | "team", interval: Interval) => void;
  usage?: { studies: number; editors: number };
  trialAvailable: boolean;
  interval?: Interval;
  onIntervalChange?: (interval: Interval) => void;
}) {
  const [localInterval, setLocalInterval] = useState<Interval>("year");
  const interval = controlledInterval ?? localInterval;
  const setInterval = onIntervalChange ?? setLocalInterval;

  return (
    <div>
      <div className="mb-6 flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanColumn
            key={plan.id}
            plan={plan}
            interval={interval}
            action={
              currentPlan === plan.id ? (
                <Button disabled variant="outline" className="h-10 w-full">Your current plan</Button>
              ) : plan.id === "free" ? (
                <Button variant="outline" disabled className="h-10 w-full">Included with every workspace</Button>
              ) : (
                <Button
                  onClick={() => {
                    if (plan.id === "pro" || plan.id === "team") onSelect(plan.id, interval);
                  }}
                  variant={plan.highlight ? "default" : "outline"}
                  className="h-10 w-full font-semibold"
                >
                  {trialAvailable ? "Start 14-day trial" : `Upgrade to ${plan.name}`}
                </Button>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

export function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  const option = (v: Interval, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === v}
      onClick={() => onChange(v)}
      className={cn(
        "min-h-9 cursor-pointer rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
        value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {option("month", "Monthly")}
      {option("year", "Yearly, save 20%")}
    </div>
  );
}
