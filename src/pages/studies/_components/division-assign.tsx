import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { SlopPill } from "@/components/slop/slop-shell.tsx";
import { cn } from "@/lib/utils.ts";
import {
  DIVISION_CHANNEL_CODES,
  DIVISION_HINTS,
  DIVISION_LABELS,
  DIVISION_SLUGS,
  isDivisionSlug,
  type DivisionSlug,
} from "@/lib/divisions.ts";

/**
 * Desktop control: assign a study to one mobile division feed (or none).
 * Matches SlopPublish — channel grid + “where it lands” card.
 */
export default function DivisionAssign({
  studyId,
  value,
}: {
  studyId: string;
  value: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const current = isDivisionSlug(value) ? value : null;

  const mutation = useMutation({
    mutationFn: (division: DivisionSlug | null) =>
      api.studies.updateDetails({ studyId, division }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["studies"] });
      toast.success("Division feed updated");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Couldn’t update division");
    },
  });

  return (
    <section className="slop-scope space-y-8 rounded-2xl p-1">
      <div className="flex flex-col items-start gap-4">
        <SlopPill dot="cyan">Review &amp; publish</SlopPill>
        <h3
          className="slop-h1 m-0 text-balance"
          style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}
        >
          Which <span className="slop-serif-emphasis slop-text-gradient-hot">channel</span> gets{" "}
          <span className="slop-underline slop-underline-cyan">this</span> study?
        </h3>
        <p className="slop-lead m-0 max-w-[52ch]">
          Assign it to a phone division feed — before or after publishing.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-6">
        <div
          className="slop-card flex min-w-0 flex-[999_1_520px] flex-col gap-5 p-8"
          aria-labelledby="slop-pd-title"
        >
          <h4
            id="slop-pd-title"
            className="m-0 font-mono text-[13px] font-normal tracking-[0.12em] uppercase"
            style={{ color: "#94a3b8" }}
          >
            Phone division feed
          </h4>
          <div
            role="group"
            aria-labelledby="slop-pd-title"
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))" }}
          >
            {DIVISION_SLUGS.map((slug) => {
              const selected = current === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={selected}
                  disabled={mutation.isPending}
                  title={DIVISION_HINTS[slug]}
                  onClick={() => mutation.mutate(slug)}
                  className={cn(
                    "flex min-h-[88px] cursor-pointer flex-col items-start justify-between gap-2.5 p-4 text-left",
                    selected ? "slop-card slop-card-beam" : "slop-card",
                  )}
                >
                  <span
                    className="font-mono text-[13px] tracking-[0.08em]"
                    style={{ color: selected ? "#c084fc" : "#94a3b8" }}
                  >
                    {DIVISION_CHANNEL_CODES[slug]}
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-extrabold tracking-tight",
                      selected && "slop-text-gradient",
                    )}
                  >
                    {DIVISION_LABELS[slug]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={current === null}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(null)}
            className={cn(
              "slop-btn min-h-[52px] w-full justify-start text-left",
              current === null ? "slop-btn-primary" : "slop-btn-ghost",
            )}
          >
            None. Keep this study off phone division feeds
          </button>
        </div>

        <aside
          className="slop-card slop-border-l-gradient flex min-w-0 flex-[1_1_300px] flex-col justify-between gap-8 p-8"
          aria-labelledby="slop-pv-title"
          aria-live="polite"
        >
          <div className="flex flex-col gap-4">
            <span className="slop-icon-box mb-0 self-start" aria-hidden>
              📡
            </span>
            <h4
              id="slop-pv-title"
              className="m-0 font-mono text-[13px] font-normal tracking-[0.12em] uppercase"
              style={{ color: "#94a3b8" }}
            >
              Where it lands
            </h4>
            {current ? (
              <>
                <div className="slop-text-gradient text-4xl font-extrabold leading-tight tracking-tight">
                  {DIVISION_LABELS[current]} channel
                </div>
                <p className="m-0 text-base leading-relaxed" style={{ color: "#cbd5e1" }}>
                  Scenes from this study appear in the {DIVISION_LABELS[current]} channel on the iOS app.
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl font-extrabold leading-tight tracking-tight">Off phone feeds</div>
                <p className="m-0 text-base leading-relaxed" style={{ color: "#cbd5e1" }}>
                  This study stays on the desktop workspace until you assign a division channel.
                </p>
              </>
            )}
          </div>
          <span className="slop-status self-start">
            <span className={cn("slop-dot", current ? "slop-dot-green" : "slop-dot-amber")} />
            {current ? "iOS app" : "Desktop only"}
          </span>
        </aside>
      </div>
    </section>
  );
}
