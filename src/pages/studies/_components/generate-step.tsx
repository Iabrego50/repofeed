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
  { key: "extract", label: "Reading your files", hint: "Pulls quotes, numbers and patterns from each file" },
  { key: "compose", label: "Finding the moments that matter", hint: "Turns the strongest findings into one-point scenes" },
  { key: "verify", label: "Writing short insight scenes", hint: "Matches every quote and number against your files" },
  { key: "queue", label: "Lining up the feed", hint: "Orders scenes for the channel" },
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
      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full border border-border text-[10px]",
            state === "done" && "border-transparent bg-success text-white",
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

  const phaseIndex = PHASES.findIndex((p) => p.key === job?.phase);
  const doneIndex = isDone ? PHASES.length : phaseIndex;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">In the edit room</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight">
            {isDone ? "That's a cut." : isRunning ? "Cutting scenes…" : "Generate scenes"}
          </h3>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {isDone
              ? "We’re reading every file so your team doesn’t have to. You can leave this tab. Nothing goes on air until you’ve reviewed it."
              : "AI extracts findings from your sources and composes them into short insight scenes."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {!job || job.status === "failed" ? (
              <Button onClick={() => act(() => startMutation.mutateAsync(), "Couldn't start generation")} disabled={busy} size="lg" className="font-semibold">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                {job ? "Retry" : "Start generation"}
              </Button>
            ) : isRunning ? (
              <Button onClick={() => act(() => cancelMutation.mutateAsync(), "Couldn't cancel generation")} disabled={busy} variant="destructive" size="lg">
                <CircleStop className="size-4" />
                Cancel
              </Button>
            ) : isDone ? (
              <Button onClick={onNext} size="lg" className="font-semibold">
                Review the scenes
              </Button>
            ) : null}
          </div>
        </div>

        {job && (
          <aside className="rounded-[1.5rem] bg-studio p-6 text-white shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">
                {study?.title ?? "Sample study"}
              </p>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  isDone ? "bg-mark text-mark-foreground" : isFailed ? "bg-destructive text-white" : "bg-white/15 text-white",
                )}
              >
                {isDone ? "Ready for review" : isFailed ? "Stopped" : isRunning ? "Cutting…" : "Queued"}
              </span>
            </div>
            <div className="mt-3 h-0.5 rounded-full bg-mark" />
            <ul className="mt-5 space-y-3">
              {PHASES.map((phase, i) => {
                const state: StepState =
                  job.phase === phase.key && isRunning
                    ? "current"
                    : job.phase === phase.key && isFailed
                      ? "failed"
                      : doneIndex > i || (isDone && i < PHASES.length)
                        ? "done"
                        : "waiting";
                return (
                  <li key={phase.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          state === "done" || state === "current" ? "bg-mark" : "bg-white/25",
                        )}
                      />
                      {phase.label}
                    </span>
                    <span className="text-white/55">
                      {state === "done" ? "Done" : state === "current" ? "Working…" : state === "failed" ? "Stopped" : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>

      {job && (
        <div className="rounded-[1.5rem] border border-border bg-card p-6 lg:hidden">
          <ul className="space-y-3">
            {PHASES.map((phase, i) => {
              const state: StepState =
                job.phase === phase.key && isRunning
                  ? "current"
                  : job.phase === phase.key && isFailed
                    ? "failed"
                    : doneIndex > i || isDone
                      ? "done"
                      : "waiting";
              const progress = job.totalChunks > 0 ? `${Math.round((job.cursor / job.totalChunks) * 100)}%` : undefined;
              return <StepCard key={phase.key} index={i} label={phase.label} hint={phase.hint} state={state} progress={progress} />;
            })}
          </ul>
        </div>
      )}

      {job?.log && job.log.length > 0 && (
        <details className="rounded-[1.5rem] border border-border bg-card p-5">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">View generation log</summary>
          <ol ref={logRef} className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-muted p-3 text-xs">
            {job.log.map((entry: any, i: number) => (
              <li key={i} className="text-muted-foreground">
                [{format(new Date(entry.timestamp), "HH:mm:ss")}] {entry.message}
              </li>
            ))}
          </ol>
        </details>
      )}

      {isFailed && job?.error && (
        <div className="flex items-start gap-3 rounded-[1.5rem] border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">Generation failed</p>
            <p className="mt-1 text-sm text-destructive/80">{job.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
