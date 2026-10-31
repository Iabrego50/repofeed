import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { Plan } from "@/convex/schema/validators.ts";
import { cn } from "@/lib/utils.ts";
import { PLANS, formatPrice, type Interval } from "@/lib/plans.ts";

export function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  const options: { id: Interval; label: string }[] = [
    { id: "month", label: "Monthly" },
    { id: "year", label: "Yearly · save 20%" },
  ];
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-10 cursor-pointer rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === o.id && "bg-primary text-primary-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pricing cards. `renderAction` supplies each card's button so callers control checkout. */
export default function PlanGrid({
  interval,
  current,
  renderAction,
  showTrial = true,
}: {
  interval: Interval;
  current?: Plan;
  renderAction: (plan: Plan) => ReactNode;
  /** False once the viewer has used their one free trial. */
  showTrial?: boolean;
}) {
  const trial = showTrial ? " 14-day free trial." : "";
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLANS.map((p) => (
        <div
          key={p.id}
          className={cn(
            "relative flex flex-col rounded-2xl border border-border bg-card p-6",
            p.highlight && "border-primary shadow-[0_30px_80px_-40px_rgba(47,155,255,0.6)]",
          )}
        >
          {p.highlight && (
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              Most popular
            </span>
          )}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-2xl font-extrabold">{p.name}</h3>
            {current === p.id && (
              <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Current
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl font-extrabold tracking-tight">{formatPrice(p.price[interval])}</span>
            <span className="text-sm text-muted-foreground">{p.unit}</span>
          </p>
          <p className="mt-1 min-h-5 text-xs text-muted-foreground">
            {p.id !== "free" &&
              `${interval === "year" ? `${formatPrice(p.price.year * 12)}${p.id === "team" ? " per editor" : ""} billed yearly.` : "Cancel anytime."}${trial} Plus applicable tax.`}
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">{renderAction(p.id)}</div>
        </div>
      ))}
    </div>
  );
}
