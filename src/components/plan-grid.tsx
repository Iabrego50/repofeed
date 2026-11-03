import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { Plan } from "@/schema/validators";
import { PLANS, formatPrice, type Interval } from "@/lib/plans.ts";

export default function PlanGrid({
  currentPlan,
  onSelect,
  usage,
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
  void usage;

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg border p-6 ${plan.highlight ? "border-primary shadow-lg" : "border-border"}`}
          >
            {plan.highlight && (
              <div className="mb-4 text-center text-xs font-semibold uppercase text-primary">
                Most Popular
              </div>
            )}
            <h3 className="text-2xl font-bold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <div className="mt-6 text-4xl font-bold">
              {formatPrice(plan.price[interval])}
              {plan.id !== "free" && (
                <span className="text-lg font-normal text-muted-foreground">/{plan.unit}</span>
              )}
            </div>
            {plan.id === "free" ? (
              <p className="mt-1 text-sm text-muted-foreground">{plan.unit}</p>
            ) : interval === "year" ? (
              <p className="mt-1 text-sm text-muted-foreground">Billed yearly (save 20%)</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Billed monthly</p>
            )}
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              {currentPlan === plan.id ? (
                <Button disabled className="w-full">
                  Current Plan
                </Button>
              ) : plan.id === "free" ? (
                <Button variant="outline" disabled className="w-full">
                  Downgrade unavailable
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (plan.id === "pro" || plan.id === "team") onSelect(plan.id, interval);
                  }}
                  variant={plan.highlight ? "default" : "outline"}
                  className="w-full"
                >
                  {trialAvailable ? "Start 14-day trial" : "Upgrade"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntervalToggle({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (v: Interval) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => onChange("month")}
        className={value === "month" ? "rounded-full bg-primary px-4 py-2 text-primary-foreground" : "px-4 py-2"}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={value === "year" ? "rounded-full bg-primary px-4 py-2 text-primary-foreground" : "px-4 py-2"}
      >
        Yearly · save 20%
      </button>
    </div>
  );
}
