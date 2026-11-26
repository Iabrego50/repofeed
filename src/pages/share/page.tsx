import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import Logo from "@/components/logo.tsx";
import { useIsDesktop } from "@/hooks/use-is-desktop.ts";
import ReelFeed from "../feed/_components/reel-feed.tsx";
import { FeedModeContext, type FeedMode } from "../feed/_lib/feed-mode.ts";
import { Presenter } from "@/pages/insights/deck/page.tsx";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import NamePrompt from "./_components/name-prompt.tsx";
import GeneratePptButton from "./_components/generate-ppt-button.tsx";
import { DeckSelectionProvider } from "./_lib/deck-selection.ts";

const secretKey = (token: string) => `fieldreel.guest.${token}`;

export default function SharePage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const isDesktop = useIsDesktop();
  const [secret, setSecret] = useState<string | null>(() =>
    token ? localStorage.getItem(secretKey(token)) : null,
  );
  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);

  const { data } = useQuery({
    queryKey: ["share", "feed", token, secret],
    queryFn: () => api.share.feed({ token, secret: secret ?? undefined }),
    enabled: !!token,
  });

  const joinMutation = useMutation({
    mutationFn: (args: { token: string; name: string }) => api.share.join(args),
  });

  const [prompting, setPrompting] = useState(false);
  const waiters = useRef<Array<(s: string | null) => void>>([]);

  const settle = (value: string | null) => {
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((w) => w(value));
    setPrompting(false);
  };

  const knownGuest = data?.guest ?? null;
  // Until feed resolves, trust the stored secret; drop it if the server rejects it.
  const validSecret = data === undefined ? secret : knownGuest ? secret : null;

  // Feed resolved without a guest for this secret — clear the stale value during render.
  if (token && data !== undefined && secret && !knownGuest) {
    localStorage.removeItem(secretKey(token));
    setSecret(null);
  }

  const ensureGuest = useCallback((): Promise<string | null> => {
    if (validSecret) return Promise.resolve(validSecret);
    return new Promise((resolve) => {
      waiters.current.push(resolve);
      setPrompting(true);
    });
  }, [validSecret]);

  const mode = useMemo<FeedMode>(
    () => ({ kind: "share", token, secret: validSecret, ensureGuest }),
    [token, validSecret, ensureGuest],
  );

  const reels = data?.reels ?? [];
  const canExport = reels.length > 0;
  const studyTitle = data?.studyTitle ?? "Research readout";

  if (data === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-paper px-5">
        <Logo />
        <Empty>
          <EmptyHeader>
            <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Share link</p>
            <EmptyMedia variant="icon"><Link2Off /></EmptyMedia>
            <EmptyTitle>This link isn't available</EmptyTitle>
            <EmptyDescription>It may have been turned off or the study was unpublished. Ask the person who sent it for a new link.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="secondary" className="h-11 font-semibold"><Link to="/">Go to repofeed.ai</Link></Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (previewDeck) {
    return (
      <div className="dark flex h-dvh flex-col bg-studio">
        <Presenter
          deck={previewDeck}
          backLabel="Feed"
          onBack={() => setPreviewDeck(null)}
        />
      </div>
    );
  }

  // Leave-feed control only; Generate appears when N > 0 (button returns null otherwise).
  const generateOverlay = canExport ? (
    <GeneratePptButton
      studyTitle={studyTitle}
      reels={reels}
      onPreview={setPreviewDeck}
      variant="overlay"
    />
  ) : null;
  const generateAside = canExport ? (
    <GeneratePptButton
      studyTitle={studyTitle}
      reels={reels}
      onPreview={setPreviewDeck}
      variant="aside"
    />
  ) : null;

  const header = (
    <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pb-4 pt-2 sm:bg-none sm:py-3">
      <Link
        to="/"
        aria-label="Back to repofeed.ai"
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-studio-panel/80 text-white/85 backdrop-blur transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Logo withText={false} />
      </Link>
      <div className="flex-1" />
      {!isDesktop && generateOverlay}
    </div>
  );

  return (
    <FeedModeContext.Provider value={mode}>
      <DeckSelectionProvider>
        <div className="dark relative h-dvh">
          <ReelFeed
            reels={data?.reels}
            deepLink={params.get("reel")}
            toolbar={header}
            asideFooter={isDesktop ? generateAside : undefined}
            empty={
              <Empty className="dark border-0 bg-transparent text-white">
                <EmptyHeader>
                  <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Shared feed</p>
                  <EmptyTitle className="text-white">No scenes here yet</EmptyTitle>
                  <EmptyDescription className="text-white/60">Check back later.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </div>
        <NamePrompt
          open={prompting}
          studyTitle={data?.studyTitle ?? "this study"}
          onCancel={() => settle(null)}
          onSubmit={async (name) => {
            const res = await joinMutation.mutateAsync({ token, name });
            localStorage.setItem(secretKey(token), res.secret);
            setSecret(res.secret);
            settle(res.secret);
          }}
        />
      </DeckSelectionProvider>
    </FeedModeContext.Provider>
  );
}
