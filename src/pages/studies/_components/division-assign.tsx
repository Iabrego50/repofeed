import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { cn } from "@/lib/utils.ts";
import {
  DIVISION_HINTS,
  DIVISION_LABELS,
  DIVISION_SLUGS,
  isDivisionSlug,
  type DivisionSlug,
} from "@/lib/divisions.ts";

/**
 * Desktop control: assign a study to one mobile division feed (or none).
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-bold">Phone division feed</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Scenes from this study appear in the selected channel on the iOS app. Leave blank to keep them off phone division feeds.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={current === null}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(null)}
          className={cn(
            "min-h-10 cursor-pointer rounded-full border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
            current === null
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:border-foreground",
          )}
        >
          None
        </button>
        {DIVISION_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            aria-pressed={current === slug}
            disabled={mutation.isPending}
            title={DIVISION_HINTS[slug]}
            onClick={() => mutation.mutate(slug)}
            className={cn(
              "min-h-10 cursor-pointer rounded-full border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              current === slug
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:border-foreground",
            )}
          >
            {DIVISION_LABELS[slug]}
          </button>
        ))}
      </div>
    </div>
  );
}
