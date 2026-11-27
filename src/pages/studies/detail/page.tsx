import { useSearchParams, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSearch, LifeBuoy, Presentation } from "lucide-react";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import PermissionDenied from "@/components/permission-denied.tsx";
import { cn } from "@/lib/utils.ts";
import StatusBadge from "../_components/status-badge.tsx";
import SourcesStep from "../_components/sources-step.tsx";
import DetailsStep from "../_components/details-step.tsx";
import GenerateStep from "../_components/generate-step.tsx";
import ReviewStep from "../_components/review-step.tsx";
import { StudyShell, type StudyShellStep } from "@/components/design-system/study-shell.tsx";

const STEPS = [
  { key: "sources", label: "Upload", shell: "upload" as const },
  { key: "details", label: "Details", shell: "upload" as const },
  { key: "generate", label: "Scenes", shell: "scenes" as const },
  { key: "review", label: "Publish", shell: "publish" as const },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

function defaultStep(status: string): StepKey {
  if (status === "generating") return "generate";
  if (status === "review" || status === "published") return "review";
  return "sources";
}

function shellFor(step: StepKey): StudyShellStep {
  return STEPS.find((s) => s.key === step)?.shell ?? "upload";
}

function StudyBody({ studyId }: { studyId: string }) {
  const { data: study } = useQuery({
    queryKey: ["studies", "get", studyId],
    queryFn: () => api.studies.get({ studyId }),
  });

  const { data: sources } = useQuery({
    queryKey: ["studies", "sources", studyId],
    queryFn: () => api.studies.listSources({ studyId }),
  });

  const hasSources = sources !== undefined && sources.length > 0;
  const [params, setParams] = useSearchParams();

  if (study === undefined) {
    return (
      <div className="space-y-4 px-6 py-10">
        <Skeleton className="h-10 w-2/3 bg-white/10" />
        <Skeleton className="h-12 w-full bg-white/10" />
        <Skeleton className="h-64 w-full rounded-2xl bg-white/10" />
      </div>
    );
  }

  const step = (params.get("step") as StepKey | null) ?? defaultStep(study.status);
  const go = (s: StepKey) => setParams({ step: s });
  const hasReels =
    study.status === "review" ||
    study.status === "published" ||
    (Array.isArray(study.tracks) && study.tracks.length > 0);

  return (
    <StudyShell step={shellFor(step)}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-300 hover:bg-white/10 hover:text-white" asChild>
          <Link to="/studies">
            <ArrowLeft className="size-4" />
            Back to studies
          </Link>
        </Button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={study.status} />
          {study.status === "published" && (
            <Button asChild variant="outline" className="h-9 border-white/20 bg-transparent text-white hover:bg-white/10">
              <Link to={`/insights/deck?study=${study._id}`}>
                <Presentation className="size-4" />{" "}
                <span className="hidden sm:inline">Create readout deck</span>
                <span className="sm:hidden">Deck</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Keep Details reachable; design shell collapses Upload/Details into tab 1. */}
      <nav className="mb-6 flex flex-wrap gap-2 lg:hidden" aria-label="Study steps">
        {STEPS.map((s, i) => {
          const disabled = (s.key === "generate" || s.key === "review") && !hasSources;
          const active = s.key === step;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => !disabled && go(s.key)}
              disabled={disabled}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-violet-500 text-white"
                  : disabled
                    ? "cursor-not-allowed bg-white/5 text-white/30"
                    : "cursor-pointer bg-white/10 text-white/80 hover:bg-white/15",
              )}
            >
              {i + 1} {s.label}
            </button>
          );
        })}
      </nav>

      <div>
        {!hasSources && (step === "generate" || step === "review") ? (
          <Empty className="rounded-2xl border border-dashed border-white/20 bg-white/5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearch />
              </EmptyMedia>
              <EmptyTitle className="text-white">Upload sources first</EmptyTitle>
              <EmptyDescription className="text-slate-400">
                You need at least one source file to generate scenes.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button type="button" className="slop-btn slop-btn-primary" onClick={() => go("sources")}>
                Go to Sources
              </button>
            </EmptyContent>
          </Empty>
        ) : step === "sources" ? (
          <SourcesStep studyId={studyId} study={study} sources={sources ?? []} onNext={() => go("details")} />
        ) : step === "details" ? (
          <DetailsStep studyId={studyId} study={study} onNext={() => go("generate")} />
        ) : step === "generate" ? (
          <GenerateStep studyId={studyId} study={study} onNext={() => go("review")} />
        ) : step === "review" ? (
          hasReels ? (
            <ReviewStep studyId={studyId} study={study} />
          ) : (
            <Empty className="rounded-2xl border border-dashed border-white/20 bg-white/5">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LifeBuoy />
                </EmptyMedia>
                <EmptyTitle className="text-white">No scenes yet</EmptyTitle>
                <EmptyDescription className="text-slate-400">
                  Generate scenes from your sources first.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <button type="button" className="slop-btn slop-btn-primary" onClick={() => go("generate")}>
                  Go to Generate
                </button>
              </EmptyContent>
            </Empty>
          )
        ) : null}
      </div>
    </StudyShell>
  );
}

export default function StudyDetailPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const { isEditor } = useWorkspace();
  if (!studyId) return null;
  if (!isEditor) return <PermissionDenied what="manage studies" />;

  return <StudyBody studyId={studyId} />;
}
