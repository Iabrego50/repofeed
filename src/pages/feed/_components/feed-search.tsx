// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery } from '@/lib/convex-compat';
import { Bookmark, CornerDownLeft, Search, SearchX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "../_lib/types.ts";
import { reelTracks, searchReels } from "../_lib/search.ts";

const MAX_RESULTS = 50;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bolds each query word inside the text. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-primary/20 px-0.5 text-foreground">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function FeedSearch({
  workspaceId,
  open,
  onOpenChange,
  onPick,
}: {
  workspaceId: Id<"workspaces">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (reel: FeedReel) => void;
}) {
  // Only subscribe while the panel is open.
  const reels = useQuery(api.feed.list, open ? { workspaceId } : "skip");
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<string | null>(null);
  const tracks = useMemo(() => reelTracks(reels ?? []), [reels]);
  const hits = useMemo(() => searchReels(reels ?? [], query, track), [reels, query, track]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const idle = words.length === 0 && track === null;

  const pick = (reel: FeedReel) => {
    onPick(reel);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-3 flex max-h-[calc(100dvh-1.5rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:top-[12vh] sm:max-h-[72vh] sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search scenes</DialogTitle>
        <DialogDescription className="sr-only">Search by words, study or category, then jump to the scene in the feed.</DialogDescription>
        <form
          className="flex items-center gap-3 border-b border-border px-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (hits[0]) pick(hits[0].reel);
          }}
        >
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scenes, quotes, studies…"
            aria-label="Search scenes"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 cursor-pointer rounded-md px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            Esc
          </button>
        </form>

        {tracks.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 scrollbar-none" role="toolbar" aria-label="Filter by category">
            {[null, ...tracks].map((t) => (
              <button
                key={t ?? "any"}
                type="button"
                aria-pressed={track === t}
                onClick={() => setTrack(t)}
                className={cn(
                  "min-h-8 shrink-0 cursor-pointer rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                  track === t && "border-transparent bg-primary text-primary-foreground hover:text-primary-foreground",
                )}
              >
                {t ?? "Any category"}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {reels === undefined ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : idle ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Type a word from a scene, a quote or a study name, or pick a category.
            </p>
          ) : hits.length === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
                <EmptyTitle>No matching scenes</EmptyTitle>
                <EmptyDescription>Try fewer or different words.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul aria-label="Search results" className="flex flex-col gap-1">
              {hits.slice(0, MAX_RESULTS).map(({ reel, snippet }, i) => (
                <li key={reel._id}>
                  <button
                    type="button"
                    onClick={() => pick(reel)}
                    className="group flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {reel.track} · {reel.studyTitle}
                      </p>
                      <p className="mt-0.5 line-clamp-2 font-display font-bold leading-snug">
                        <Highlight text={reel.title} words={words} />
                      </p>
                      {snippet && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          <Highlight text={snippet} words={words} />
                        </p>
                      )}
                    </div>
                    {reel.saved && <Bookmark className="mt-1 size-4 shrink-0 fill-primary text-primary" aria-label="Saved" />}
                    {i === 0 && (
                      <CornerDownLeft className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!idle && reels !== undefined && hits.length > 0 && (
          <p className="border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
            {hits.length} {hits.length === 1 ? "scene" : "scenes"}
            {hits.length > MAX_RESULTS && ` · showing the first ${MAX_RESULTS}`}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
