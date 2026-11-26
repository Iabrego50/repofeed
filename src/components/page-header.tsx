import type { ReactNode } from "react";

/** Page title block. `eyebrow` is mono uppercase context above a heavy title. */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-2 text-balance break-words text-3xl font-bold tracking-tight sm:text-[2.125rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
