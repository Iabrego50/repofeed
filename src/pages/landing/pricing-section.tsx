import { useState } from "react";
import { IntervalToggle, PlanColumn } from "@/components/plan-grid.tsx";
import { PLANS, type Interval } from "@/lib/plans.ts";
import { CtaLink } from "./_components/cta.tsx";

/** Public pricing. Every button leads to sign-up; upgrades happen inside the app. */
export default function PricingSection({ variant = "" }: { variant?: string }) {
  const [interval, setInterval] = useState<Interval>("year");
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 lg:py-20">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="pricing-heading" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Pay for editors. Viewers are free.</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            The people who watch, react and comment never need a paid seat. Paid plans start with a 14-day free trial, one per person. Prices don’t include tax.
          </p>
        </div>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanColumn
            key={plan.id}
            plan={plan}
            interval={interval}
            action={
              <CtaLink location={`pricing_${plan.id}`} variant={variant} secondary={!plan.highlight} className="w-full">
                {plan.id === "free" ? "Start free" : "Start 14-day trial"}
              </CtaLink>
            }
          />
        ))}
      </div>
    </section>
  );
}
