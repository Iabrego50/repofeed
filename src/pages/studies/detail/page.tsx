import { useSearchParams, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSearch, LifeBuoy } from "lucide-react";
import { api } from "@/lib/api/complete";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import PageHeader from "@/components/page-header.tsx";
import { cn } from "@/lib/utils.ts";
import StatusBadge from "../_components/status-badge.tsx";
import SourcesStep from "../_components/sources-step.tsx";
import DetailsStep from "../_components/details-step.tsx";
import GenerateStep from "../_components/generate-step.tsx";
import ReviewStep from "../_components/review-step.tsx";

const STEPS = [
  { key: "sources", label: "Sources" },
  { key: "details", label: "Details" },
  { key: "generate", label: "Generate" },
  { key: "review", label: "Review & publish" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

function defaultStep(status: string): StepKey {
  if (status === "generating") return "generate";
  if (status === "review" || status === "published") return "review";
  return "sources";
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
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  
  const step = (params.get("step") as StepKey | null) ?? defaultStep(study.status);
  const go = (s: StepKey) => setParams({ step: s });
  const hasReels = study.status === "review" || study.status === "published" || (study.tracks && study.tracks.length > 0);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <PageHeader title={study.title} />
        <div className="flex items-center gap-2">
          <StatusBadge status={study.status} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{study.audience}</p>

      <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-border">
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
                "shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : disabled
                    ? "cursor-not-allowed border-transparent text-muted-foreground/50"
                    : "cursor-pointer border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {i + 1}. {s.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        {!hasSources && (step === "generate" || step === "review") ? (
          <Empty className="rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
              <EmptyTitle>Upload sources first</EmptyTitle>
              <EmptyDescription>You need at least one source file to generate scenes.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => go("sources")}>Go to Sources</Button>
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
            <Empty className="rounded-2xl border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><LifeBuoy /></EmptyMedia>
                <EmptyTitle>No scenes yet</EmptyTitle>
                <EmptyDescription>Generate scenes from your sources first.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => go("generate")}>Go to Generate</Button>
              </EmptyContent>
            </Empty>
          )
        ) : null}
      </div>
    </>
  );
}

export default function StudyDetailPage() {
  const { studyId } = useParams<{ studyId: string }>();
  if (!studyId) return null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:py-12">
      <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
        <Link to="/studies">
          <ArrowLeft className="size-4" />
          Back to studies
        </Link>
      </Button>
      <StudyBody studyId={studyId} />
    </div>
  );
}
