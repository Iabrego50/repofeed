// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from '@/lib/convex-compat';
import { Bookmark, Clapperboard, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { cn } from "@/lib/utils.ts";
import ReelFeed from "./_components/reel-feed.tsx";
import FeedSearch from "./_components/feed-search.tsx";

const CHIP =
  "min-h-8 shrink-0 cursor-pointer rounded-full border border-white/10 bg-black/30 px-3 text-[11px] font-semibold text-white/75 backdrop-blur transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-ring sm:min-h-9 sm:text-xs";
const CHIP_ON = "border-transparent bg-white text-black hover:text-black";

export default function FeedPage() {
  const { current, isEditor } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const savedView = params.get("view") === "saved";
  const studyFilter = savedView ? undefined : (params.get("study") ?? undefined);
  
  const { data: studies } = useQuery({
    queryKey: ["studies", "list", current?._id],
    queryFn: () => api.studies.list({ workspaceId: current!._id }),
    enabled: !!current,
  });
  
  const { data: feedReels } = useQuery({
    queryKey: ["feed", "list", current?._id, studyFilter],
    queryFn: () => api.feed.list({ workspaceId: current!._id, studyId: studyFilter }),
    enabled: !!current && !savedView,
  });
  
  const { data: savedReels } = useQuery({
    queryKey: ["feed", "saved", current?._id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      return api.feed.saved({ workspaceId: current!._id, userId: user.id });
    },
    enabled: !!current && savedView,
  });
  
  const reels = savedView ? savedReels : feedReels;
  const published = useMemo(() => studies?.filter((s: any) => s.status === "published") ?? [], [studies]);
  const [searchOpen, setSearchOpen] = useState(false);
  // Bumped on every search pick so choosing the same scene again still jumps to it.
  const [jumpKey, setJumpKey] = useState(0);

  // "/" opens search, like most search boxes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!current) return null;

  const chips: Array<{ key: string; label: string; active: boolean; onClick: () => void }> = [
    { key: "all", label: "All studies", active: !savedView && !studyFilter, onClick: () => setParams({}) },
    ...(published.length > 1
      ? published.map((s: any) => ({ key: s._id, label: s.title, active: studyFilter === s._id, onClick: () => setParams({ study: s._id }) }))
      : []),
  ];

  const toolbar = (
    <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pb-4 pt-2 sm:bg-none sm:py-3 lg:justify-center">
      <div className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-none sm:gap-2" role="toolbar" aria-label="Filter the feed">
        <button
          type="button"
          onClick={() => setParams(savedView ? {} : { view: "saved" })}
          aria-pressed={savedView}
          className={cn(CHIP, "flex items-center gap-1.5", savedView && CHIP_ON)}
        >
          <Bookmark className={cn("size-3.5", savedView && "fill-current")} /> Saved
        </button>
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={c.onClick} aria-pressed={c.active} className={cn(CHIP, c.active && CHIP_ON)}>
            <span className="block max-w-[140px] truncate sm:max-w-[200px]">{c.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search scenes"
        title="Search scenes (/)"
        className="ml-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-black/30 text-white/85 backdrop-blur transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-ring lg:ml-0"
      >
        <Search className="size-4" />
      </button>
    </div>
  );

  const empty = savedView ? (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Bookmark /></EmptyMedia>
        <EmptyTitle>Nothing saved yet</EmptyTitle>
        <EmptyDescription>Tap the bookmark on any scene to keep it here for later. Only you can see your Saved list.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button className="h-11" onClick={() => setParams({})}>Back to the feed</Button>
      </EmptyContent>
    </Empty>
  ) : (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Clapperboard /></EmptyMedia>
        <EmptyTitle>No scenes in your feed yet</EmptyTitle>
        <EmptyDescription>
          {isEditor ? "Create a study from your research files and publish it to fill the feed." : "When an editor publishes a study, its scenes show up here."}
        </EmptyDescription>
      </EmptyHeader>
      {isEditor && (
        <EmptyContent>
          <Button asChild className="h-11"><Link to="/studies/new">Create a study</Link></Button>
        </EmptyContent>
      )}
    </Empty>
  );

  return (
    <>
    <FeedSearch
      workspaceId={current._id}
      open={searchOpen}
      onOpenChange={setSearchOpen}
      onPick={(reel) => {
        // Results come from the full feed, so jump there with the scene selected.
        setParams({ reel: reel._id });
        setJumpKey((k) => k + 1);
      }}
    />
    <ReelFeed
      reels={reels}
      deepLink={params.get("reel")}
      jumpKey={jumpKey}
      resetKey={savedView ? "saved" : (studyFilter ?? "all")}
      toolbar={toolbar}
      empty={empty}
    />
    </>
  );
}
