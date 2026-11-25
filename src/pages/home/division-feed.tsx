import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useIsDesktop } from "@/hooks/use-is-desktop.ts";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import ReelFeed from "@/pages/feed/_components/reel-feed.tsx";
import GeneratePptButton from "@/pages/share/_components/generate-ppt-button.tsx";
import { DeckSelectionProvider } from "@/pages/share/_lib/deck-selection.ts";
import { Presenter } from "@/pages/insights/deck/page.tsx";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import {
  DIVISION_HOME_PATH,
  DIVISION_LABELS,
  isDivisionSlug,
  type DivisionSlug,
} from "@/lib/divisions.ts";
import { useState } from "react";

/** Native (and previewable) feed for one division — separate stream, not a chip filter. */
export default function DivisionFeedPage() {
  const { division: raw } = useParams();
  const { current } = useWorkspace();
  const isDesktop = useIsDesktop();
  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);

  if (!isDivisionSlug(raw)) {
    return <Navigate to={DIVISION_HOME_PATH} replace />;
  }
  const division = raw as DivisionSlug;

  const { data: reels, isLoading } = useQuery({
    queryKey: ["feed", "list", current?._id, "division", division],
    queryFn: () => api.feed.list({ workspaceId: current!._id, division }),
    enabled: !!current,
  });

  if (!current) return null;

  const label = DIVISION_LABELS[division];
  const canExport = (reels?.length ?? 0) > 0;
  const generateOverlay = canExport ? (
    <GeneratePptButton
      studyTitle={`${label} · ${current.name}`}
      reels={reels ?? []}
      onPreview={setPreviewDeck}
      variant="overlay"
    />
  ) : null;
  const generateAside = canExport ? (
    <GeneratePptButton
      studyTitle={`${label} · ${current.name}`}
      reels={reels ?? []}
      onPreview={setPreviewDeck}
      variant="aside"
    />
  ) : null;

  const toolbar = (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Button
        asChild
        variant="ghost"
        className="pointer-events-auto h-11 text-white hover:bg-white/10 hover:text-white"
      >
        <Link to={DIVISION_HOME_PATH}>
          <ArrowLeft className="size-4" /> {label}
        </Link>
      </Button>
      <div className="pointer-events-auto">{!isDesktop && generateOverlay}</div>
    </div>
  );

  const empty = (
    <Empty className="dark border-0 bg-transparent text-white">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Clapperboard /></EmptyMedia>
        <EmptyTitle className="text-white">Nothing in {label} yet</EmptyTitle>
        <EmptyDescription className="text-white/60">
          Your research team hasn’t published scenes to this division. Check back soon, or pick another channel.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild variant="secondary" className="mt-4 h-11">
        <Link to={DIVISION_HOME_PATH}>Back to channels</Link>
      </Button>
    </Empty>
  );

  if (previewDeck) {
    return (
      <div className="dark flex h-full min-h-0 flex-col bg-background">
        <Presenter deck={previewDeck} backLabel={label} onBack={() => setPreviewDeck(null)} />
      </div>
    );
  }

  return (
    <DeckSelectionProvider>
      <div className="dark h-full min-h-0 bg-black">
        <ReelFeed
          reels={isLoading ? undefined : reels}
          deepLink={null}
          resetKey={`division-${division}`}
          toolbar={toolbar}
          asideFooter={isDesktop ? generateAside : undefined}
          empty={empty}
        />
      </div>
    </DeckSelectionProvider>
  );
}
