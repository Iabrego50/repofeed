import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

export type JoinCodePanelViewProps = {
  workspaceName: string;
  code?: string | null;
  loading?: boolean;
  regenerating?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  /** Hide the email form (design screen 07 / harness). */
  hideEmail?: boolean;
  className?: string;
  emailSlot?: React.ReactNode;
};

/**
 * Presentational team join-code panel matching design screen 07.
 * Settings wires live data; the design harness passes fixtures.
 */
export function JoinCodePanelView({
  workspaceName,
  code,
  loading,
  regenerating,
  onCopy,
  onRegenerate,
  hideEmail,
  className,
  emailSlot,
}: JoinCodePanelViewProps) {
  const digits = (code ?? "").padEnd(8, " ").slice(0, 8).split("");

  return (
    <section className={cn("space-y-5", className)}>
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">
          {workspaceName} · workspace
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Get your team on the channel.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You’re an owner of this workspace. Share the join code and viewers land straight in your feed.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[1.5rem] bg-studio p-6 text-white shadow-lift">
          <p className="font-mono text-[10px] tracking-[0.14em] text-eyebrow uppercase">Team join code</p>
          {loading || !code ? (
            <Skeleton className="mt-5 h-16 w-full rounded-xl bg-white/10" />
          ) : (
            <div className="mt-5 grid grid-cols-8 gap-1.5 sm:gap-2" aria-label="Team join code">
              {digits.map((ch, i) => (
                <span
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-[#0a0d16] font-mono text-lg font-bold text-mark sm:text-xl"
                >
                  {ch.trim() || "·"}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="h-11 font-semibold" disabled={!code} onClick={onCopy}>
              <Copy className="size-4" /> Copy code
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              disabled={regenerating}
              onClick={onRegenerate}
            >
              {regenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Regenerate
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/45">Regenerating revokes the previous code immediately.</p>
        </div>

        <aside className="rounded-[1.5rem] border border-border bg-card p-6 shadow-lift">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            How viewers join
          </p>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              "Open the iOS app, or go to /join on the web",
              "Enter the code",
              `Start scrolling ${workspaceName}`,
            ].map((line, i) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {!hideEmail && emailSlot}
    </section>
  );
}
