import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, Check, CircleStop, Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

const PHASES = [
  { key: "extract", label: "Read your files", hint: "Pulls quotes, numbers and patterns from each file" },
  { key: "compose", label: "Write scenes", hint: "Turns the strongest findings into one-point scenes" },
  { key: "verify", label: "Check quotes & numbers", hint: "Matches every quote and number against your files" },
] as const;

type StepState = "done" | "current" | "failed" | "waiting";

function StepCard({ index, label, hint, state, progress }: { index: number; label: string; hint: string; state: StepState; progress?: string }) {
  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3",
        state === "current" && "border-primary",
        state === "failed" && "border-destructive/60",
      )}
    >
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full border border-border text-[10px]",
            state === "done" && "border-transparent bg-[#3FE0A0] text-black",
            state === "current" && "border-primary text-primary",
            state === "failed" && "border-transparent bg-destructive text-white",
          )}
        >
          {state === "done" ? <Check className="size-3" strokeWidth={3} /> : state === "failed" ? "!" : index + 1}
        </span>
        Step {index + 1}
      </p>
      <p className="mt-2 flex items-center gap-2 font-medium">
        {state === "current" && <Loader2 className="size-4 animate-spin" />}
        {label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {state === "done" ? "Done" : state === "failed" ? "Stopped here" : state === "current" ? progress ?? "Working…" : hint}
      </p>
      {state === "current" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div className="h-full w-full animate-pulse rounded-full bg-primary/60" />
        </div>
      )}
    </li>
  );
}

interface GenerateStepProps {
  studyId: string;
  study: any;
  onNext: () => void;
}

export default function GenerateStep({ studyId, study, onNext }: GenerateStepProps) {
  const queryClient = useQueryClient();
  const { data: job } = useQuery({
    queryKey: ["generation", "jobs", "latest", studyId],
    queryFn: () => api.generation.jobs.latestForStudy({ studyId }),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === "running" || data.status === "queued" ? 2000 : false;
    },
  });

  const startMutation = useMutation({
    mutationFn: () => api.generation.jobs.startGeneration({ studyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generation", "jobs", "latest", studyId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.generation.jobs.cancelGeneration({ studyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generation", "jobs", "latest", studyId] });
      toast.success("Generation cancelled");
    },
  });

  const logRef = useRef<HTMLOListElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job?.log?.length]);

  const act = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      toast.error(err.message || fail);
    } finally {
      setBusy(false);
    }
  };

  const isRunning = job?.status === "running" || job?.status === "queued";
  const isDone = job?.status === "done";
  const isFailed = job?.status === "failed";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Generate scenes</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              AI will extract findings from your sources and compose them into scenes.
            </p>
          </div>
          {!job || job.status === "failed" ? (
            <Button onClick={() => act(() => startMutation.mutateAsync(), "Couldn't start generation")} disabled={busy} size="lg">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {job ? "Retry" : "Start generation"}
            </Button>
          ) : isRunning ? (
            <Button onClick={() => act(() => cancelMutation.mutateAsync(), "Couldn't cancel generation")} disabled={busy} variant="destructive" size="lg">
              <CircleStop className="size-4" />
              Cancel
            </Button>
          ) : isDone ? (
            <Button onClick={onNext} size="lg">
              Continue to Review
            </Button>
          ) : null}
        </div>

        {job && (
          <ul className="mt-6 space-y-3">
            {PHASES.map((phase, i) => {
              const state: StepState =
                job.phase === phase.key && isRunning
                  ? "current"
                  : job.phase === phase.key && isFailed
                    ? "failed"
                    : PHASES.findIndex((p) => p.key === job.phase) > i
                      ? "done"
                      : "waiting";
              const progress = job.totalChunks > 0 ? `${Math.round((job.cursor / job.totalChunks) * 100)}%` : undefined;
              return <StepCard key={phase.key} index={i} label={phase.label} hint={phase.hint} state={state} progress={progress} />;
            })}
          </ul>
        )}

        {job?.log && job.log.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">View generation log</summary>
            <ol ref={logRef} className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {job.log.map((entry: any, i: number) => (
                <li key={i} className="text-muted-foreground">
                  [{format(new Date(entry.timestamp), "HH:mm:ss")}] {entry.message}
                </li>
              ))}
            </ol>
          </details>
        )}

        {isFailed && job?.error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-destructive">Generation failed</p>
              <p className="mt-1 text-sm text-destructive/80">{job.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
