import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, CircleStop, Loader2, Play } from "lucide-react";
import { SlopPill } from "@/components/slop/slop-shell.tsx";
import { cn } from "@/lib/utils.ts";

const PHASES = [
  { key: "extract", label: "Reading your files", hint: "Pulls quotes, numbers and patterns from each file" },
  { key: "compose", label: "Finding the moments that matter", hint: "Turns the strongest findings into one-point scenes" },
  { key: "verify", label: "Writing short insight scenes", hint: "Matches every quote and number against your files" },
  { key: "queue", label: "Lining up the feed", hint: "Orders scenes for the channel" },
] as const;

type StepState = "done" | "current" | "failed" | "waiting";

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
  const progressPct = isDone
    ? 100
    : phaseIndex < 0
      ? 0
      : Math.min(100, Math.round(((phaseIndex + (isRunning ? 0.5 : 0)) / PHASES.length) * 100));

  const headline = isDone ? "That’s a cut." : isRunning ? "Cutting your scenes." : "Generate scenes";

  return (
    <div className="slop-scope space-y-6 rounded-2xl p-1">
      <div className="rf-rise grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <SlopPill dot="pink">In the edit room</SlopPill>
          <h3
            className="slop-h1 slop-text-gradient m-0 text-balance"
            aria-live="polite"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
          >
            {headline}
          </h3>
          <p className="slop-lead m-0 max-w-[44ch]">
            {isDone || isRunning
              ? "We’re reading every file so your team doesn’t have to. You can leave this tab — nothing goes on air until you’ve reviewed it."
              : "AI extracts findings from your sources and composes them into short insight scenes."}
          </p>
          <div className="slop-row mt-1 flex-wrap">
            {!job || job.status === "failed" ? (
              <button
                type="button"
                className="slop-btn slop-btn-primary slop-btn-lg"
                onClick={() => act(() => startMutation.mutateAsync(), "Couldn't start generation")}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                {job ? "Retry" : "Start generation"}
              </button>
            ) : isRunning ? (
              <button
                type="button"
                className="slop-btn slop-btn-ghost slop-btn-lg"
                onClick={() => act(() => cancelMutation.mutateAsync(), "Couldn't cancel generation")}
                disabled={busy}
              >
                <CircleStop className="size-4" />
                Cancel
              </button>
            ) : isDone ? (
              <button type="button" className="slop-btn slop-btn-primary slop-btn-lg" onClick={onNext}>
                Review the scenes
              </button>
            ) : null}
          </div>
        </div>

        {job && (
          <aside className="flex min-h-[280px] items-center justify-center">
            <div className="slop-card slop-card-beam flex w-full max-w-[440px] flex-col gap-6 p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="slop-row">
                  <span className="slop-icon-box slop-icon-pink mb-0" aria-hidden>
                    ✂️
                  </span>
                  <span
                    className="font-mono text-[13px] tracking-[0.12em] uppercase"
                    style={{ color: "#94a3b8" }}
                  >
                    {study?.title ?? "Sample study"}
                  </span>
                </span>
                <span className="slop-status">
                  <span
                    className={cn(
                      "slop-dot",
                      isDone ? "slop-dot-green" : isFailed ? "slop-dot-red" : "slop-dot-purple",
                    )}
                  />
                  {isDone ? "Ready for review" : isFailed ? "Stopped" : isRunning ? "Cutting" : "Queued"}
                </span>
              </div>
              <div className="slop-progress" aria-hidden>
                <div className="slop-progress-bar" style={{ width: `${progressPct}%` }} />
              </div>
              <ol className="m-0 flex list-none flex-col gap-[18px] p-0">
                {PHASES.map((phase, i) => {
                  const state: StepState =
                    job.phase === phase.key && isRunning
                      ? "current"
                      : job.phase === phase.key && isFailed
                        ? "failed"
                        : doneIndex > i || (isDone && i < PHASES.length)
                          ? "done"
                          : "waiting";
                  const active = state === "current";
                  const done = state === "done";
                  return (
                    <li
                      key={phase.key}
                      className="flex items-center gap-3.5"
                      style={{ color: done || active ? "#f8fafc" : "#94a3b8" }}
                    >
                      <span
                        aria-hidden
                        className={active ? "slop-dot slop-dot-purple shrink-0" : "shrink-0"}
                        style={
                          active
                            ? undefined
                            : {
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                background: done ? "#10b981" : "rgba(148,163,184,.35)",
                              }
                        }
                      />
                      <span className="flex-1 text-lg font-semibold">{phase.label}</span>
                      <span className="font-mono text-[13px]">
                        {state === "done"
                          ? "Done"
                          : state === "current"
                            ? "Working"
                            : state === "failed"
                              ? "Stopped"
                              : "Queued"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        )}
      </div>

      {job?.log && job.log.length > 0 && (
        <details className="slop-card p-5">
          <summary className="cursor-pointer text-sm font-medium" style={{ color: "#94a3b8" }}>
            View generation log
          </summary>
          <ol ref={logRef} className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-black/40 p-3 text-xs">
            {job.log.map((entry: any, i: number) => (
              <li key={i} style={{ color: "#94a3b8" }}>
                [{format(new Date(entry.timestamp), "HH:mm:ss")}] {entry.message}
              </li>
            ))}
          </ol>
        </details>
      )}

      {isFailed && job?.error && (
        <div className="slop-alert slop-border-l-rose flex items-start gap-3 p-4">
          <AlertTriangle className="size-5 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="m-0 font-medium text-red-300">Generation failed</p>
            <p className="mt-1 text-sm text-red-300/80">{job.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
