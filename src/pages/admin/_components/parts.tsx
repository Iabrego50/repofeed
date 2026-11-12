import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";
import type { FunnelStep, NamedCount } from "@/lib/api/admin-analytics.ts";
import { num } from "../_lib/format.ts";

export function Panel({ title, hint, actions, children, className }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {actions}
      </header>
      <div className="px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, emphasis }: { label: string; value: string; sub?: string; emphasis?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-card px-4 py-3.5", emphasis && "border-foreground/80")}>
      <p className="truncate text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function CountList({ rows, empty }: { rows: NamedCount[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <ol className="space-y-2.5">
      {rows.slice(0, 8).map((row) => (
        <li key={row.name} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm">{row.name}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
            </div>
          </div>
          <span className="text-sm font-semibold">{num(row.count)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Every step is measured against the first one, since people can skip around between the middle steps. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((step) => step.count), 1);
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => {
        const conv = steps[0].count > 0 ? Math.round((step.count / steps[0].count) * 100) : 0;
        return (
          <li key={step.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm">{step.label}</p>
              <p className="text-sm">
                <span className="font-semibold">{num(step.count)}</span>
                {i > 0 && <span className="ml-2 text-muted-foreground">{conv}%</span>}
              </p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(step.count ? 3 : 0, (step.count / max) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "min-h-8 cursor-pointer rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
            value === item.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground";
export const TD = "whitespace-nowrap px-3 py-2.5 text-sm";
