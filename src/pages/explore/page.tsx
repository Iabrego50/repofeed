import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api/complete";
import { askResearch, tagTopics } from "@/lib/api/explore.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import type { FeedReel } from "@/lib/api/mappers.ts";
import type { LibraryInsight } from "@/lib/research-search.ts";
import ExploreView from "./_components/explore-view.tsx";

function toInsight(reel: FeedReel): LibraryInsight {
  return {
    id: reel._id,
    title: reel.title,
    track: reel.track,
    studyTitle: reel.studyTitle ?? "",
    topics: reel.topics ?? [],
    scenes: reel.scenes ?? [],
  };
}

/**
 * Explore: browse every insight by topic, filter by keyword as you type, or ask
 * a question and get a short answer that cites the insights it came from.
 */
export default function ExplorePage() {
  const { current } = useWorkspace();
  const queryClient = useQueryClient();

  const libraryKey = ["feed", "library", current?._id];
  const { data: reels, isLoading } = useQuery({
    queryKey: libraryKey,
    queryFn: () => api.feed.list({ workspaceId: current!._id, limit: 2000 }),
    enabled: !!current,
    staleTime: 60_000,
  });
  const insights = useMemo(() => (reels ?? []).map(toInsight), [reels]);
  const untagged = insights.filter((i) => i.topics.length === 0).length;

  const [tagging, setTagging] = useState<"idle" | "running" | "done">("idle");
  const tagStarted = useRef(false);
  useEffect(() => {
    if (!current || isLoading || untagged === 0 || tagStarted.current) return;
    tagStarted.current = true;
    const workspaceId = current._id;
    setTagging("running");
    void (async () => {
      for (let round = 0; round < 10; round++) {
        try {
          const result = await tagTopics({ workspaceId });
          if (result.tagged > 0) await queryClient.invalidateQueries({ queryKey: ["feed", "library", workspaceId] });
          if (result.tagged === 0 || result.remaining === 0) break;
        } catch {
          break;
        }
      }
      setTagging("done");
    })();
  }, [current, isLoading, untagged, queryClient]);

  if (!current) return null;

  return (
    <ExploreView
      insights={insights}
      loading={isLoading}
      eyebrow={current.name}
      title="Explore your research"
      description="Browse by topic, search by any word, or ask a question and get an answer that points to the insights behind it."
      watchHref={(id) => `/feed?reel=${id}`}
      performAsk={({ question, topics }) => askResearch({ workspaceId: current._id, question, topics })}
      askKey={current._id}
      trackMeta={{ workspaceId: current._id }}
      topicStatus={
        tagging === "running" && untagged > 0 ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Adding topics to {untagged} {untagged === 1 ? "insight" : "insights"}
          </p>
        ) : null
      }
    />
  );
}
