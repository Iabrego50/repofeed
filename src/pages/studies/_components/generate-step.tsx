import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, Check, CircleStop, Play, RotateCcw, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { errorMessage } from "@/lib/errors.ts";
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
        {state === "current" && <Spinner className="size-4" />}
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

export default function GenerateStep({ studyId, onDone }: { studyId: Id<"studies">; onDone: () => void }) {
  const job = useQuery(api.generation.jobs.latestForStudy, { studyId });
  const start = useMutation(api.generation.jobs.startGeneration);
  const resume = useMutation(api.generation.jobs.resumeGeneration);
  const cancel = useMutation(api.generation.jobs.cancelGeneration);
  const logRef = useRef<HTMLOListElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job?.log.length]);

  const act = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err, fail));
    } finally {
      setBusy(false);
    }
  };
  const run = () => act(() => start({ studyId }), "Couldn't start generation");

  if (job === undefined) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const active = job && (job.status === "queued" || job.status === "running");
  const failed = job?.status === "failed";
  const phaseIdx = job ? PHASES.findIndex((p) => p.key === job.phase) : -1;

  const stateFor = (i: number): StepState => {
    if (!job) return "waiting";
    if (job.status === "done" || i < phaseIdx) return "done";
    if (i === phaseIdx) return failed ? "failed" : active ? "current" : "waiting";
    return "waiting";
  };

  if (!job || job.status === "cancelled") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Sparkles className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-bold">
          {job?.status === "cancelled" ? "Generation was stopped" : "Ready to generate"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          The AI reads every file, picks out findings, writes 8–24 one-point scenes, then checks every quote and number against your files. It keeps running if you close this tab.
        </p>
        <Button size="lg" className="mt-6 h-12 px-6 font-semibold" disabled={busy} onClick={() => void run()}>
          {busy ? <Spinner /> : job ? <RotateCcw className="size-4" /> : <Sparkles className="size-4" />}
          {job ? "Start again" : "Generate scenes"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="grid gap-2 sm:grid-cols-3">
        {PHASES.map((p, i) => (
          <StepCard
            key={p.key}
            index={i}
            label={p.label}
            hint={p.hint}
            state={stateFor(i)}
            progress={
              p.key === "extract"
                ? `File part ${Math.min(job.cursor + 1, job.totalChunks)} of ${job.totalChunks}`
                : p.key === "compose"
                  ? "Writing 8–24 one-point scenes"
                  : "Matching every quote and number to your files"
            }
          />
        ))}
      </ol>

      {failed && (
        <div role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Generation stopped</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{job.error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className="h-10" disabled={busy} onClick={() => void act(() => resume({ studyId }), "Couldn't resume")}>
                  {busy ? <Spinner /> : <Play className="size-4" />} Resume where it stopped
                </Button>
                <Button variant="secondary" className="h-10" disabled={busy} onClick={() => void run()}>
                  <RotateCcw className="size-4" /> Start over
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Activity</p>
          {active && (
            <span className="flex items-center gap-2 font-mono text-xs text-primary">
              <span className="size-2 animate-pulse rounded-full bg-primary" /> running
            </span>
          )}
        </div>
        <ol ref={logRef} className="max-h-72 space-y-1 overflow-y-auto p-4 font-mono text-[13px]" aria-live="polite">
          {job.log.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-muted-foreground">{format(new Date(l.at), "HH:mm:ss")}</span>
              <span className={cn("min-w-0 break-words", l.level === "warn" && "text-[#FFC23D]", l.level === "error" && "text-destructive")}>{l.message}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {active && (
          <Button variant="destructive" className="h-11" onClick={() => void act(() => cancel({ studyId }), "Couldn't stop")}>
            <CircleStop className="size-4" /> Stop
          </Button>
        )}
        {job.status === "done" && (
          <>
            <Button variant="secondary" className="h-11" disabled={busy} onClick={() => void run()}>
              <RotateCcw className="size-4" /> Regenerate
            </Button>
            <Button className="h-11 font-semibold" onClick={onDone}>Review scenes</Button>
          </>
        )}
      </div>
    </div>
  );
}
