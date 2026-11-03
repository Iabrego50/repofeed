import { useState } from "react";
import { motion } from "motion/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { IntervalToggle } from "@/components/plan-grid.tsx";
import { PLANS, formatPrice, type Interval } from "@/lib/plans.ts";

/** Public pricing; every button leads to sign-up, upgrades happen in-app. */
export default function PricingSection() {
  const [interval, setInterval] = useState<Interval>("year");
  return (
    <section id="pricing" className="relative mx-auto max-w-6xl px-5 pb-24 pt-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center"
      >
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Pricing</p>
        <h2 className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Pay for editors. Viewers are free.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Stakeholders who watch, react and comment never need a paid seat. Every paid plan starts with a 14-day free trial (one per person). Prices exclude applicable tax.
        </p>
        <div className="mt-6 flex justify-center">
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      </motion.div>
      <div className="mt-10">
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
                  <span className="text-base font-normal text-muted-foreground">/{plan.unit}</span>
                )}
              </div>
              {plan.id === "free" ? (
                <p className="mt-1 text-sm text-muted-foreground">{plan.unit}</p>
              ) : interval === "year" && plan.price.year < plan.price.month ? (
                <p className="mt-1 text-sm text-primary">
                  Save ${((plan.price.month - plan.price.year) * 12).toFixed(0)}/year
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Billed monthly</p>
              )}
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-sm">
                    ✓ {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <SignInButton
                  size="lg"
                  variant={plan.id === "pro" ? "default" : "secondary"}
                  className="h-11 w-full font-semibold"
                  signInText={plan.id === "free" ? "Get started free" : "Start 14-day trial"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
