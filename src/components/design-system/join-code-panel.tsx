import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SlopPill } from "@/components/slop/slop-shell.tsx";
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
 * Presentational team join-code panel matching SlopJoinCode.
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
    <section className={cn("slop-scope space-y-10 rounded-2xl p-1", className)}>
      <div className="flex flex-col items-start gap-4">
        <SlopPill dot="green">
          {workspaceName} · Workspace
        </SlopPill>
        <h2
          className="slop-h1 m-0 text-balance"
          style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}
        >
          Get your team <span className="slop-underline">on</span> the{" "}
          <span className="slop-serif-emphasis slop-text-gradient-hot">channel</span>.
        </h2>
        <p className="slop-lead m-0 max-w-[52ch]">
          You’re an owner of this workspace. Share the join code — viewers land straight in your feed.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-6">
        <div
          className="slop-card slop-card-beam flex min-w-0 flex-[999_1_520px] flex-col gap-6 p-8"
          aria-labelledby="slop-jc-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h3
              id="slop-jc-title"
              className="m-0 font-mono text-[13px] font-normal tracking-[0.12em] uppercase"
              style={{ color: "#94a3b8" }}
            >
              Team join code
            </h3>
          </div>
          {loading || !code ? (
            <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
          ) : (
            <div
              className="grid grid-cols-8 gap-1.5 sm:gap-2.5"
              aria-label="Team join code"
              role="img"
            >
              {digits.map((ch, i) => (
                <span
                  key={i}
                  className="flex aspect-[3/4] items-center justify-center rounded-xl border font-mono text-[clamp(1.25rem,3.2vw,2.5rem)] font-bold"
                  style={{
                    background: "rgba(2, 6, 23, .7)",
                    borderColor: "rgba(192, 132, 252, .35)",
                  }}
                >
                  <span className="slop-text-gradient">{ch.trim() || "·"}</span>
                </span>
              ))}
            </div>
          )}
          <div className="slop-row flex-wrap">
            <button
              type="button"
              className="slop-btn slop-btn-primary slop-btn-lg"
              disabled={!code}
              onClick={onCopy}
            >
              <Copy className="size-4" /> Copy code
            </button>
            <button
              type="button"
              className="slop-btn slop-btn-ghost slop-btn-lg"
              disabled={regenerating}
              onClick={onRegenerate}
            >
              {regenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Regenerate
            </button>
          </div>
          <div className="slop-alert slop-border-l-amber">
            <span className="slop-dot slop-dot-amber mt-[7px]" />
            <div>Regenerating revokes the previous code immediately.</div>
          </div>
        </div>

        <aside
          className="slop-card slop-border-l-cyan flex min-w-0 flex-[1_1_300px] flex-col gap-5 p-8"
          aria-labelledby="slop-how-title"
        >
          <span className="slop-icon-box slop-icon-cyan mb-0" aria-hidden>
            📱
          </span>
          <h3
            id="slop-how-title"
            className="m-0 font-mono text-[13px] font-normal tracking-[0.12em] uppercase"
            style={{ color: "#94a3b8" }}
          >
            How viewers join
          </h3>
          <ol className="m-0 flex list-none flex-col gap-4 p-0 text-base leading-snug">
            {[
              <>
                Open the iOS app, or go to <span className="slop-mono text-[15px]">/join</span> on the web
              </>,
              "Enter the code",
              `Start scrolling ${workspaceName}`,
            ].map((line, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-[26px] shrink-0 place-items-center rounded-full font-mono text-[13px] text-white"
                  style={{ background: "linear-gradient(135deg, #4338ca, #7e22ce)" }}
                >
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {!hideEmail && emailSlot}
    </section>
  );
}
