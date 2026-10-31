import { cn } from "@/lib/utils.ts";

/** Brand lockup: layered-data mark plus "repo" + blue "feed" + ".ai" wordmark. */
export default function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/logo-mark.png" alt="" aria-hidden width={46} height={32} className="h-8 w-auto shrink-0" />
      {withText && (
        <span className="font-display text-xl font-extrabold tracking-tight">
          repo
          <span className="bg-gradient-to-r from-[#1e7bff] to-[#2fc6ff] bg-clip-text text-transparent">feed</span>
          .ai
        </span>
      )}
    </span>
  );
}
