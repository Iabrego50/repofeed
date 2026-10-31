import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { Button } from "@/components/ui/button.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import PageHeader from "@/components/page-header.tsx";
import PermissionDenied from "@/components/permission-denied.tsx";
import Empty from "@/components/empty.tsx";

export default function StudiesPage() {
  const { current, isEditor } = useWorkspace();
  
  const { data: allStudies } = useQuery({
    queryKey: ["studies", "list", current?._id],
    queryFn: () => api.studies.list({ workspaceId: current!._id }),
    enabled: !!current && isEditor,
  });

  if (!current) return null;
  if (!isEditor) return <PermissionDenied what="view studies" />;

  if (!allStudies || allStudies.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <PageHeader title="Studies" />
        <Empty
          title="No studies yet"
          description="Create your first study to get started"
          action={
            <Button asChild>
              <Link to="/studies/new">
                <PlusIcon className="size-4" />
                New study
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center justify-between">
        <PageHeader title="Studies" />
        <Button asChild>
          <Link to="/studies/new">
            <PlusIcon className="size-4" />
            New study
          </Link>
        </Button>
      </div>
      <div className="mt-6 space-y-3">
        {allStudies.map((study: any) => (
          <Link
            key={study._id}
            to={`/studies/${study._id}`}
            className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{study.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{study.audience}</p>
                {study.tracks && study.tracks.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {study.tracks.length} track{study.tracks.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              <StatusBadge status={study.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
