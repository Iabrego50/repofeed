import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import ExportDialog from "@/components/reel/export-dialog.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";
import type { FeedReel } from "../_lib/types.ts";
import { useFeedOrder } from "../_lib/use-feed-order.ts";
import CaughtUp from "./caught-up.tsx";
import FeedSlide from "./feed-slide.tsx";
import ReelPanel, { type PanelTab } from "./reel-panel.tsx";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/** Snap-scrolling reel feed with a discussion/evidence panel. Shared by members and share links. */
export default function ReelFeed({
  reels: rawReels,
  deepLink,
  toolbar,
  empty,
  resetKey,
  jumpKey = 0,
}: {
  reels: FeedReel[] | undefined;
  deepLink: string | null;
  /** Bump to jump to `deepLink` again, e.g. picking the same search result twice. */
  jumpKey?: number;
  toolbar?: ReactNode;
  empty: ReactNode;
  /** Changing this scrolls back to the top (e.g. a new study filter). */
  resetKey?: string;
}) {
  const { ordered: reels, fresh } = useFeedOrder(rawReels, resetKey);
  // On a first visit everything is unwatched, so a "New" badge on every scene would be noise.
  const showBadges = reels !== undefined && fresh.size < reels.length;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [desktopTab, setDesktopTab] = useState<PanelTab>("discussion");
  const [exporting, setExporting] = useState<ReelData | null>(null);
  const isDesktop = useIsDesktop();
  const deepLinkHandled = useRef<string | null>(null);
  const [lastReset, setLastReset] = useState(resetKey);

  if (resetKey !== lastReset) {
    setLastReset(resetKey);
    setActiveIdx(0);
  }

  // Scroll back to the top when the filter changes.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  const scrollTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el || !reels) return;
    // The extra slot past the last scene is the "All caught up" card.
    const clamped = Math.max(0, Math.min(reels.length, i));
    el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
  }, [reels]);

  // Track the visible reel from scroll position.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setActiveIdx(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [reels !== undefined && reels.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link: jump to ?reel=<id> once it's loaded.
  useEffect(() => {
    const jump = `${deepLink}:${jumpKey}`;
    if (!reels || !deepLink || deepLinkHandled.current === jump) return;
    const i = reels.findIndex((r) => r._id === deepLink);
    if (i < 0) return;
    deepLinkHandled.current = jump;
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = i * el.clientHeight;
      setActiveIdx(i);
    });
  }, [reels, deepLink, jumpKey]);

  // Keyboard: arrows and j/k move between reels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollTo(activeIdx + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollTo(activeIdx - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, scrollTo]);

  const activeReel = reels?.[Math.min(activeIdx, (reels?.length ?? 1) - 1)];

  const openPanel = (tab: PanelTab) => {
    if (isDesktop) setDesktopTab(tab);
    else setPanel(tab);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col items-center bg-[#04070E]">
        {toolbar}

        {reels === undefined ? (
          <div className="flex h-full w-full max-w-[min(100%,calc((100dvh-4rem)*9/16))] items-center p-4">
            <Skeleton className="aspect-[9/16] w-full rounded-2xl" />
          </div>
        ) : reels.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5">{empty}</div>
        ) : (
          <div
            ref={scrollerRef}
            className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none lg:max-w-[calc(100dvh*9/16+5rem)]"
            aria-label="Scene feed. Use arrow keys or J and K to move."
          >
            {reels.map((r, i) => (
              <div key={r._id} className="h-full w-full">
                {Math.abs(i - activeIdx) <= 1 ? (
                  <FeedSlide
                    reel={r}
                    active={i === activeIdx}
                    isNew={showBadges && fresh.has(r._id) && !r.seen}
                    onEnded={() => scrollTo(i + 1)}
                    onOpenPanel={openPanel}
                    onExport={() => setExporting({
                      title: r.title,
                      track: r.track,
                      trackIndex: r.trackIndex,
                      studyTitle: r.studyTitle,
                      scenes: r.scenes || [],
                      footage: r.footage,
                    })}
                  />
                ) : (
                  <div className="h-full w-full snap-start bg-black" aria-hidden />
                )}
              </div>
            ))}
            <CaughtUp total={reels.length} watchedNew={fresh.size} onRestart={() => scrollTo(0)} />
          </div>
        )}
      </div>

      {isDesktop && activeReel && (
        <aside className="hidden w-[380px] shrink-0 border-l border-border lg:flex">
          <ReelPanel reel={activeReel} tab={desktopTab} onTab={setDesktopTab} className="w-full" />
        </aside>
      )}

      <AnimatePresence>
        {!isDesktop && panel && activeReel && (
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
              aria-label="Scene discussion and evidence"
              className="fixed inset-x-0 bottom-0 z-50 flex h-[78dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
            >
              <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
              <ReelPanel reel={activeReel} tab={panel} onTab={setPanel} onClose={() => setPanel(null)} className="min-h-0 flex-1" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ExportDialog reel={exporting} onClose={() => setExporting(null)} />
    </div>
  );
}
