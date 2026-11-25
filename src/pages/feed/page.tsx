import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard } from "lucide-react";
import { api } from "@/lib/api/complete";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { isNativePlatform } from "@/lib/native";
import { useIsDesktop } from "@/hooks/use-is-desktop.ts";
import FeedTour from "@/components/feed-tour.tsx";
import ReelFeed from "./_components/reel-feed.tsx";
import { Presenter } from "@/pages/insights/deck/page.tsx";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import GeneratePptButton from "@/pages/share/_components/generate-ppt-button.tsx";
import { DeckSelectionProvider } from "@/pages/share/_lib/deck-selection.ts";

export default function FeedPage() {
  const { current, isEditor } = useWorkspace();
  const { nativeViewerMode } = useNativeViewer();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const replayTour = params.get("tour") === "1";
  const isDesktop = useIsDesktop();
  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => api.users.current(),
  });

  const completeTour = useMutation({
    mutationFn: async () => {
      if (!profile?.onboardedAt) {
        await api.users.update({ onboardedAt: new Date().toISOString() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      if (replayTour) {
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("tour");
            return next;
          },
          { replace: true },
        );
      }
    },
  });
  const savedView = params.get("view") === "saved";
  const studyFilter = savedView ? undefined : (params.get("study") ?? undefined);

  const { data: studies } = useQuery({
    queryKey: ["studies", "list", current?._id],
    queryFn: () => api.studies.list({ workspaceId: current!._id }),
    enabled: !!current,
  });

  const { data: unreadIds } = useQuery({
    queryKey: ["studyViews", "unread", current?._id],
    queryFn: () => api.studyViews.unreadIds({ workspaceId: current!._id }),
    enabled: !!current,
    refetchInterval: 60_000,
  });
  const unreadSet = useMemo(() => new Set(unreadIds ?? []), [unreadIds]);

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

  useEffect(() => {
    if (!studyFilter || !unreadSet.has(studyFilter)) return;
    void api.studyViews.markSeen({ studyId: studyFilter }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["studyViews", "unread", current?._id] });
    });
  }, [studyFilter, unreadSet, queryClient, current?._id]);

  useEffect(() => {
    const reelId = params.get("reel");
    if (!reelId || !feedReels) return;
    const hit = (feedReels as Array<{ _id?: string; id?: string; studyId?: string; study_id?: string }>).find(
      (r) => r._id === reelId || r.id === reelId,
    );
    const studyId = hit?.studyId ?? hit?.study_id;
    if (!studyId || !unreadSet.has(studyId)) return;
    void api.studyViews.markSeen({ studyId }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["studyViews", "unread", current?._id] });
    });
  }, [params, feedReels, unreadSet, queryClient, current?._id]);

  const reels = savedView ? savedReels : feedReels;
  const published = useMemo(
    () => (studies ?? []).filter((s) => s.status === "published"),
    [studies],
  );
  const showCreateCta = isEditor && !nativeViewerMode && !isNativePlatform();
  if (!current) return null;

  const studyTitle =
    (studyFilter && published.find((s) => s._id === studyFilter)?.title) ||
    current.name ||
    "Research readout";
  const canExport = (reels?.length ?? 0) > 0;
  // Generate only mounts when N > 0 (button itself returns null at 0).
  // Generate mounts only when N > 0 (button returns null at 0) — minimal stream chrome.
  const generateOverlay = canExport ? (
    <GeneratePptButton
      studyTitle={studyTitle}
      reels={reels ?? []}
      onPreview={setPreviewDeck}
      variant="overlay"
    />
  ) : null;
  const generateAside = canExport ? (
    <GeneratePptButton
      studyTitle={studyTitle}
      reels={reels ?? []}
      onPreview={setPreviewDeck}
      variant="aside"
    />
  ) : null;

  const toolbar = canExport ? (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end bg-gradient-to-b from-black/60 to-transparent px-3 pb-4 pt-2 sm:bg-none sm:py-3">
      <div className="pointer-events-auto">{!isDesktop && generateOverlay}</div>
    </div>
  ) : null;

  const empty = (
    <Empty className="dark border-0 bg-transparent text-white">
      <EmptyHeader>
        <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Your feed</p>
        <EmptyMedia variant="icon" className="mt-3 bg-studio-panel text-mark"><Clapperboard /></EmptyMedia>
        <EmptyTitle className="text-white">No scenes in your feed yet</EmptyTitle>
        <EmptyDescription className="text-white/60">
          {showCreateCta ? "Create a study from your research files and publish it to fill the feed." : "When an editor publishes a study, its scenes show up here."}
        </EmptyDescription>
      </EmptyHeader>
      {showCreateCta && (
        <EmptyContent>
          <Button asChild className="h-11 font-semibold"><Link to="/studies/new">Create a study</Link></Button>
        </EmptyContent>
      )}
    </Empty>
  );

  if (previewDeck) {
    return (
      <div className="dark flex h-full min-h-0 flex-col bg-background">
        <Presenter
          deck={previewDeck}
          backLabel="Feed"
          onBack={() => setPreviewDeck(null)}
        />
      </div>
    );
  }

  return (
    <DeckSelectionProvider>
      <FeedTour
        open={Boolean(replayTour || (profile && !profile.onboardedAt))}
        isEditor={showCreateCta}
        onDone={() => completeTour.mutate()}
      />
      <ReelFeed
        reels={reels}
        deepLink={params.get("reel")}
        jumpKey={params.get("reel") ? 1 : 0}
        resetKey={savedView ? "saved" : (studyFilter ?? "all")}
        toolbar={toolbar}
        asideFooter={isDesktop ? generateAside : undefined}
        empty={empty}
      />
    </DeckSelectionProvider>
  );
}
