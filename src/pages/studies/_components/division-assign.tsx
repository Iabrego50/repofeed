import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
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
 * Matches design screen 08 — channel grid + “where it lands” card.
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
    <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-lift">
        <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Review & publish</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight">Which channel gets this study?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Assign it to a phone division feed. You can do this before or after publishing.
        </p>

        <div className="mt-6">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Phone division feed
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    "min-h-[4.5rem] cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected
                      ? "border-studio bg-studio text-white"
                      : "border-border bg-background hover:border-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[11px] tracking-[0.12em]",
                      selected ? "text-mark" : "text-muted-foreground",
                    )}
                  >
                    {DIVISION_CHANNEL_CODES[slug]}
                  </span>
                  <span className={cn("mt-1 block text-lg font-bold", selected ? "text-white" : "text-foreground")}>
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
              "mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              current === null
                ? "border-foreground bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            None. Keep this study off phone division feeds
          </button>
        </div>
      </div>

      <aside className="rounded-[1.5rem] bg-studio p-6 text-white shadow-lift">
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Where it lands</p>
        {current ? (
          <>
            <p className="mt-3 text-2xl font-bold text-mark">{DIVISION_LABELS[current]} channel</p>
            <p className="mt-2 text-sm text-white/70">
              Scenes from this study appear in the {DIVISION_LABELS[current]} channel on the iOS app.
            </p>
            <span className="mt-6 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              iOS app
            </span>
          </>
        ) : (
          <>
            <p className="mt-3 text-2xl font-bold text-white/80">Off phone feeds</p>
            <p className="mt-2 text-sm text-white/60">
              This study stays on the desktop workspace until you assign a division channel.
            </p>
          </>
        )}
      </aside>
    </section>
  );
}
