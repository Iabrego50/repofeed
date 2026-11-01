import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, FolderPlus, Layers } from "lucide-react";
import { api } from "@/lib/api/complete";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import PageHeader from "@/components/page-header.tsx";
import PermissionDenied from "@/components/permission-denied.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { usePlan } from "@/hooks/use-plan.ts";
import { cn } from "@/lib/utils.ts";
import type { StudyStatus } from "@/schema/validators.ts";
import StatusBadge from "./_components/status-badge.tsx";
import StudyActions from "./_components/study-actions.tsx";

interface Study {
  _id: string;
  _creationTime: number;
  title: string;
  audience: string;
  status: StudyStatus;
  isDemo?: boolean;
}

const FREE_LIMIT = 3;

function StudyList({ studies, archived }: { studies: Study[]; archived: boolean }) {
  return (
    <ul className={cn("divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card", archived && "opacity-80")}>
      {studies.map((s) => (
        <li key={s._id} className="flex items-center gap-1 pr-2 transition-colors hover:bg-accent">
          <Link
            to={`/studies/${s._id}`}
            className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 px-5 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-display text-lg font-bold">
                <span className="truncate">{s.title}</span>
                {s.isDemo && (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">Demo</span>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {s.audience} · {formatDistanceToNow(new Date(s._creationTime), { addSuffix: true })}
              </p>
            </div>
            <StatusBadge status={s.status} />
          </Link>
          <StudyActions studyId={s._id} title={s.title} archived={archived} isDemo={s.isDemo} />
        </li>
      ))}
    </ul>
  );
}

function FreeUsageNote({ used }: { used: number }) {
  const full = used >= FREE_LIMIT;
  return (
    <p className={cn("mt-4 rounded-xl border px-4 py-3 text-sm", full ? "border-[#FFC23D]/50 bg-[#FFC23D]/10 text-[#FFC23D]" : "border-border text-muted-foreground")}>
      {used} of {FREE_LIMIT} free studies used{full ? ". Archive one or " : ". The demo study doesn't count. "}
      {full ? (
        <Link to="/billing" className="cursor-pointer font-semibold underline underline-offset-2">upgrade for unlimited studies</Link>
      ) : (
        <Link to="/billing" className="cursor-pointer underline underline-offset-2">See plans</Link>
      )}
      .
    </p>
  );
}

export default function StudiesPage() {
  const { current, isEditor } = useWorkspace();
  const { data: studies } = useQuery({
    queryKey: ["studies", "list", current?._id],
    queryFn: () => api.studies.list({ workspaceId: current!._id }),
    enabled: !!current && isEditor,
  });
  const { data: usage } = useQuery({
    queryKey: ["billing", "usage", current?._id],
    queryFn: () => api.billing.data.usage({ workspaceId: current!._id }),
    enabled: !!current && isEditor,
  });
  const { plan } = usePlan();
  const [showArchived, setShowArchived] = useState(false);
  
  if (!current) return null;
  if (!isEditor) return <PermissionDenied what="manage studies" />;
  
  const active = studies?.filter((s) => s.status !== "archived");
  const archived = studies?.filter((s) => s.status === "archived") ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:py-12">
      <PageHeader
        eyebrow={current.name}
        title="Studies"
        description="Each study turns a set of research files into a series of scenes."
        actions={
          <Button asChild size="lg" className="h-11 font-semibold">
            <Link to="/studies/new"><FolderPlus className="size-4" /> New study</Link>
          </Button>
        }
      />
      {plan === "free" && usage && <FreeUsageNote used={usage.studies} />}
      <div className="mt-6">
        {active === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : active.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Layers /></EmptyMedia>
              <EmptyTitle>No studies yet</EmptyTitle>
              <EmptyDescription>Upload interviews, surveys or notes and repofeed.ai will turn them into scenes.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="h-11"><Link to="/studies/new">Create your first study</Link></Button>
            </EmptyContent>
          </Empty>
        ) : (
          <StudyList studies={active} archived={false} />
        )}
      </div>
      {archived.length > 0 && (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronDown className={cn("size-4 transition-transform", showArchived && "rotate-180")} />
            Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-3">
              <StudyList studies={archived} archived />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
