// @ts-nocheck
import { useSearchParams, useParams, Link } from "react-router-dom";
import { useQuery } from '@/lib/convex-compat';
import { ArrowLeft, FileSearch, LifeBuoy } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

function StudyBody({ studyId }: { studyId: Id<"studies"> }) {
  const study = useQuery(api.studies.get, { studyId });
  const sources = useQuery(api.studies.listSources, { studyId });
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
  const hasReels = study.status === "review" || study.status === "published" || study.tracks.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={study.audience ? `For ${study.audience}` : "Study"}
        title={study.title}
        actions={<StatusBadge status={study.status} />}
      />
      <nav aria-label="Study steps" className="mt-8 flex gap-1 overflow-x-auto border-b border-border scrollbar-none">
        {STEPS.map((s, i) => {
          const disabled = (s.key === "generate" && !hasSources) || (s.key === "review" && !hasReels);
          return (
            <button
              key={s.key}
              type="button"
              disabled={disabled}
              onClick={() => go(s.key)}
              aria-current={step === s.key ? "step" : undefined}
              className={cn(
                "-mb-px flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40",
                step === s.key && "border-primary text-foreground",
              )}
            >
              <span className="font-mono text-xs">{i + 1}</span> {s.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-6">
        {step === "sources" && (
          <>
            <SourcesStep studyId={studyId} />
            <div className="mt-6 flex justify-end">
              <Button size="lg" className="h-12 font-semibold" disabled={!hasSources} onClick={() => go("details")}>
                {hasSources ? "Continue to details" : "Add a file to continue"}
              </Button>
            </div>
          </>
        )}
        {step === "details" && <DetailsStep study={study} onSaved={() => go("generate")} />}
        {step === "generate" && <GenerateStep studyId={studyId} onDone={() => go("review")} />}
        {step === "review" && <ReviewStep study={study} />}
      </div>
    </>
  );
}

export default function StudyPage() {
  const { studyId } = useParams();
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link to="/studies" className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All studies
        </Link>
        <Link to="/help?article=create-study" className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <LifeBuoy className="size-4" /> How studies work
        </Link>
      </div>
      {studyId ? (
        <StudyBody studyId={studyId as Id<"studies">} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
            <EmptyTitle>Study not found</EmptyTitle>
            <EmptyDescription>It may have been removed.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button asChild><Link to="/studies">Back to studies</Link></Button></EmptyContent>
        </Empty>
      )}
    </div>
  );
}
