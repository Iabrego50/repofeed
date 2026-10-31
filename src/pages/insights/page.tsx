// @ts-nocheck
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConvex, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { BarChart3, Download, Presentation } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import PageHeader from "@/components/page-header.tsx";
import PermissionDenied from "@/components/permission-denied.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { downloadCsv, toCsv } from "@/lib/csv.ts";

import InsightsDashboard, { AudienceToggle } from "./_components/insights-dashboard.tsx";
import WatchersDialog from "./_components/watchers-dialog.tsx";
import { pct, type Audience, type Row } from "./_lib/columns.ts";

const reelHref = (id: string) => `/?reel=${id}`;

export default function InsightsPage() {
  const { current, isEditor } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const studyId = (params.get("study") as Id<"studies"> | null) ?? undefined;
  const summary = useQuery(api.insights.summary, current && isEditor ? { workspaceId: current._id, studyId } : "skip");
  const allStudies = useQuery(api.studies.list, current && isEditor ? { workspaceId: current._id } : "skip");
  const convex = useConvex();
  const [exporting, setExporting] = useState<"reels" | "comments" | null>(null);
  const [audience, setAudience] = useState<Audience>("everyone");
  const [watching, setWatching] = useState<Row | null>(null);

  if (!current) return null;
  if (!isEditor) return <PermissionDenied what="see insights" />;

  const published = allStudies?.filter((s) => s.status === "published") ?? [];
  const scopeName = studyId ? published.find((s) => s._id === studyId)?.title ?? "study" : "all-studies";

  const exportReels = () => {
    if (!summary) return;
    const csv = toCsv(
      ["Study", "Track", "Scene", "People", "Team", "Guests", "Finished", "Finish rate", "Total plays", "Rings true", "Surprised me", "Push back", "Comments", "Open items"],
      summary.rows.map((r) => [r.studyTitle, r.track, r.title, r.viewers, r.teamViewers, r.guestViewers, r.completions, pct(r.completionRate), r.views, r.trueCount, r.surprisedCount, r.pushbackCount, r.commentCount, r.openCount]),
    );
    downloadCsv(`repofeed-scenes-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csv);
  };

  const exportComments = async () => {
    setExporting("comments");
    try {
      const comments = await convex.query(api.insights.exportComments, { workspaceId: current._id, studyId });
      const csv = toCsv(
        ["Study", "Scene", "Type", "Author", "Comment", "Resolved", "Reply", "Created (UTC)"],
        comments.map((c) => [c.study, c.reel, c.kind, c.author, c.body, c.kind === "note" ? "" : c.resolved ? "yes" : "no", c.isReply ? "yes" : "no", c.createdAt]),
      );
      downloadCsv(`repofeed-comments-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csv);
    } catch {
      toast.error("Couldn't export comments. Try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8 lg:py-12">
      <PageHeader
        eyebrow="Insights"
        title="Was the research watched?"
        description="Reach, completion and reactions across your published scenes."
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button asChild className="col-span-2 h-11">
              <Link to={studyId ? `/insights/deck?study=${studyId}` : "/insights/deck"}>
                <Presentation className="size-4" /> Slide deck
              </Link>
            </Button>
            <Button variant="secondary" className="h-11" onClick={exportReels} disabled={!summary}>
              <Download className="size-4" /> <span className="sm:hidden">Scenes CSV</span><span className="hidden sm:inline">Scene stats CSV</span>
            </Button>
            <Button variant="secondary" className="h-11" onClick={() => void exportComments()} disabled={exporting !== null}>
              {exporting === "comments" ? <Spinner /> : <Download className="size-4" />} Comments CSV
            </Button>
          </div>
        }
      />
      <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <label htmlFor="insight-scope" className="sr-only">Study</label>
          <NativeSelect
            id="insight-scope"
            className="h-11 w-full"
            value={studyId ?? "all"}
            onChange={(e) => setParams(e.target.value === "all" ? {} : { study: e.target.value })}
          >
            <NativeSelectOption value="all">All published studies</NativeSelectOption>
            {published.map((s) => (
              <NativeSelectOption key={s._id} value={s._id}>{s.title}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <AudienceToggle value={audience} onChange={setAudience} />
      </div>

      {summary === undefined ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl sm:h-32" />)}
        </div>
      ) : summary.rows.length === 0 ? (
        <Empty className="mt-8 rounded-2xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BarChart3 /></EmptyMedia>
            <EmptyTitle>Nothing to measure yet</EmptyTitle>
            <EmptyDescription>Publish a study and share the feed. Views and reactions show up here live.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button asChild className="h-11"><Link to="/studies">Go to studies</Link></Button></EmptyContent>
        </Empty>
      ) : (
        <>
          <InsightsDashboard summary={summary} audience={audience} showStudy={!studyId} reelHref={reelHref} onShowWatchers={setWatching} />
          <WatchersDialog reel={watching} audience={audience} onClose={() => setWatching(null)} />
        </>
      )}
    </div>
  );
}
