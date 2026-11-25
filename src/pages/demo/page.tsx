import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BarChart3, Compass, RotateCcw, Presentation } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import ReelPanel, {
  type PanelTab,
} from "@/pages/feed/_components/reel-panel.tsx";
import DemoSlide from "./_components/demo-slide.tsx";
import {
  addLocalComment,
  buildDemoReels,
  initialInteractionState,
  isTypingTarget,
  toFeedReel,
  toggleHeardBefore,
  toggleHeart,
  type DemoInteractionState,
} from "./_lib/demo-interactions.ts";
import { track } from "@/lib/analytics";
import { isNativePlatform } from "@/lib/native";
import { useIsDesktop } from "@/hooks/use-is-desktop.ts";
import { useIsResearcher } from "@/hooks/use-is-researcher.ts";
import { useSnapFeedIndex } from "@/pages/feed/_lib/use-snap-feed-index.ts";
import { Presenter } from "@/pages/insights/deck/page.tsx";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import GeneratePptButton from "@/pages/share/_components/generate-ppt-button.tsx";
import { DeckSelectionProvider } from "@/pages/share/_lib/deck-selection.ts";
import { SAMPLE_STUDY } from "./_lib/sample.ts";

const REELS = buildDemoReels();

/** Public sample feed — same four stream actions as the researcher feed. */
export default function DemoPage() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { activeIdx, scrollTo, scrollingRef, activeRef, setActiveIdx } = useSnapFeedIndex(
    scrollerRef,
    REELS.length,
  );
  const [interactions, setInteractions] = useState<DemoInteractionState>(() =>
    initialInteractionState(REELS),
  );
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [desktopTab, setDesktopTab] = useState<PanelTab>("discussion");
  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);
  const isDesktop = useIsDesktop();
  const { isResearcher } = useIsResearcher();
  const onEnd = activeIdx >= REELS.length;
  const active = REELS[Math.min(activeIdx, REELS.length - 1)];
  const activeScene = interactions[active.id];
  const pickerReels = useMemo(
    () =>
      REELS.map((r) =>
        toFeedReel(
          r,
          interactions[r.id] ?? {
            hearted: false,
            hearts: 0,
            heardBefore: false,
            saved: false,
            comments: [],
          },
        ),
      ),
    [interactions],
  );

  const [params] = useSearchParams();
  const startScene = Number(params.get("scene") ?? 0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (
      !el ||
      !Number.isInteger(startScene) ||
      startScene <= 0 ||
      startScene >= REELS.length
    )
      return;
    el.scrollTo({ top: startScene * el.clientHeight });
    setActiveIdx(startScene);
  }, [startScene, setActiveIdx]);

  useEffect(() => {
    track("feed_open", { demo: true });
  }, []);

  useEffect(() => {
    if (onEnd || !active) return;
    track("reel_open", { demo: true, reelId: active.id, index: activeIdx });
    track("scene_view", { demo: true, reelId: active.id, index: activeIdx });
  }, [active?.id, activeIdx, onEnd, active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollTo(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollTo(activeRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollTo, activeRef]);

  const openPanel = useCallback(
    (tab: PanelTab) => {
      if (isDesktop) setDesktopTab(tab);
      else setPanel(tab);
    },
    [isDesktop],
  );

  const addComment = useCallback(
    (args: {
      reelId: string;
      kind: "note" | "question" | "action";
      body: string;
      parentId?: string;
    }) => {
      setInteractions((s) => addLocalComment(s, args.reelId, args));
      track("comment", { demo: true, reelId: args.reelId, kind: args.kind });
    },
    [],
  );

  const feedReel = useMemo(
    () => (activeScene ? toFeedReel(active, activeScene) : null),
    [active, activeScene],
  );

  const panelProps =
    feedReel && activeScene
      ? {
          reel: feedReel,
          comments: activeScene.comments,
          onAddComment: addComment,
          findings: active.findings,
        }
      : null;

  if (previewDeck) {
    return (
      <div className="dark flex h-dvh flex-col bg-background">
        <Presenter
          deck={previewDeck}
          backLabel="Feed"
          onBack={() => setPreviewDeck(null)}
        />
      </div>
    );
  }

  const generateOverlay = (
    <GeneratePptButton
      studyTitle={SAMPLE_STUDY.title}
      reels={pickerReels}
      onPreview={setPreviewDeck}
      variant="overlay"
    />
  );
  const generateAside = (
    <GeneratePptButton
      studyTitle={SAMPLE_STUDY.title}
      reels={pickerReels}
      onPreview={setPreviewDeck}
      variant="aside"
    />
  );

  return (
    <DeckSelectionProvider>
      <div className="dark flex h-dvh bg-background">
        <div className="relative flex min-w-0 flex-1 flex-col items-center bg-background">
          <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pb-4 pt-2 sm:bg-none sm:py-3">
            <Link
              to="/"
              aria-label="Back to repofeed.ai"
              className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 text-xs font-semibold text-white/85 backdrop-blur transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <Logo withText={false} />
              <span className="truncate">Demo</span>
            </Link>
            <div className="ml-auto">{!isDesktop && generateOverlay}</div>
          </div>
          <div
            ref={scrollerRef}
            className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain scrollbar-none touch-pan-y"
            aria-label="Demo scene feed. Use arrow keys or J and K to move."
          >
            {REELS.map((r, i) => {
              const scene = interactions[r.id];
              return (
                <div key={r.key} className="h-full w-full snap-start">
                  <DemoSlide
                    reel={r}
                    mounted={Math.abs(i - activeIdx) <= 2}
                    active={i === activeIdx}
                    onEnded={() => {
                      if (scrollingRef.current || activeRef.current !== i) return;
                      scrollTo(i + 1);
                    }}
                    liked={scene?.hearted ?? false}
                    heardBefore={scene?.heardBefore ?? false}
                    commentCount={scene?.comments.length ?? 0}
                    onLike={() => {
                      setInteractions((s) => toggleHeart(s, r.id));
                      track("heart", { demo: true, reelId: r.id, kind: "true" });
                    }}
                    onHeardBefore={() => {
                      setInteractions((s) => toggleHeardBefore(s, r.id));
                      track("heart", { demo: true, reelId: r.id, kind: "surprised" });
                    }}
                    onOpenPanel={openPanel}
                  />
                </div>
              );
            })}
            <EndCard onRestart={() => scrollTo(0)} showResearcherCtas={isResearcher} />
          </div>
        </div>

        {isDesktop && (
          <aside className="hidden w-[380px] shrink-0 flex-col border-l border-border lg:flex">
            {panelProps ? (
              <ReelPanel
                {...panelProps}
                tab={desktopTab}
                onTab={setDesktopTab}
                className="min-h-0 flex-1"
              />
            ) : (
              <div className="min-h-0 flex-1" />
            )}
            {generateAside}
          </aside>
        )}

        <AnimatePresence>
          {!isDesktop && panel && panelProps && (
            <>
              <motion.div
                key="scrim"
                className="fixed inset-0 z-50 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setPanel(null)}
              />
              <motion.div
                key="sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Scene discussion"
                className="fixed inset-x-0 bottom-0 z-50 flex h-[78dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 32, stiffness: 340 }}
              >
                <span
                  aria-hidden
                  className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border"
                />
                <ReelPanel
                  {...panelProps}
                  tab={panel}
                  onTab={setPanel}
                  onClose={() => setPanel(null)}
                  className="min-h-0 flex-1"
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </DeckSelectionProvider>
  );
}

function EndCard({
  onRestart,
  showResearcherCtas,
}: {
  onRestart: () => void;
  showResearcherCtas: boolean;
}) {
  return (
    <div className="flex h-full w-full snap-start flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,rgba(47,155,255,0.25),transparent_60%)] px-8 text-center">
      <Logo />
      <h2 className="text-balance text-3xl font-bold text-white">
        That's the whole study, in {REELS.length} scenes.
      </h2>
      <p className="max-w-xs text-sm text-white/70">
        Drop in your own interviews and surveys, and get a feed like this for
        your team in minutes.
      </p>
      <SignInButton
        size="lg"
        className="h-12 px-6 text-base font-semibold"
        signInText="Get started free"
      />
      {showResearcherCtas && (
        <Button asChild variant="secondary" className="h-11">
          <Link to="/demo/explore">
            <Compass className="size-4" /> Search these insights
          </Link>
        </Button>
      )}
      {showResearcherCtas && !isNativePlatform() && (
        <>
          <Button asChild variant="secondary" className="h-11">
            <Link to="/demo/insights">
              <BarChart3 className="size-4" /> See who watched, in Insights
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-11">
            <Link to="/demo/deck">
              <Presentation className="size-4" /> Make a PowerPoint deck
            </Link>
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        onClick={onRestart}
        className="h-11 text-white/80 hover:text-white"
      >
        <RotateCcw className="size-4" /> Watch again
      </Button>
    </div>
  );
}
