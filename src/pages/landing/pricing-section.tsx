import { useState } from "react";
import { motion } from "motion/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import PlanGrid, { IntervalToggle } from "@/components/plan-grid.tsx";
import type { Interval } from "@/lib/plans.ts";

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
        <PlanGrid
          interval={interval}
          renderAction={(p) => (
            <SignInButton
              size="lg"
              variant={p === "pro" ? "default" : "secondary"}
              className="h-11 w-full font-semibold"
              signInText={p === "free" ? "Get started free" : "Start 14-day trial"}
            />
          )}
        />
      </div>
    </section>
  );
}
