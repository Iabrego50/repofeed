import { cn } from "@/lib/utils.ts";

/** Brand lockup: layered-data mark plus the wordmark. Inherits text colour, so it sits on paper or in the theater. */
export default function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/logo-mark.png" alt="" aria-hidden width={40} height={28} className="h-7 w-auto shrink-0" />
      {withText && (
        <span className="text-[1.0625rem] font-bold tracking-tight">
          repofeed<span className="text-muted-foreground">.ai</span>
        </span>
      )}
    </span>
  );
}
