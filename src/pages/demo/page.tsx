import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, BarChart3, RotateCcw, X } from "lucide-react";
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
  persistHintsDismissed,
  readHintsDismissed,
  toFeedReel,
  toggleHeart,
  toggleSave,
  type DemoInteractionState,
} from "./_lib/demo-interactions.ts";
import { track } from "@/lib/analytics";

const REELS = buildDemoReels();

function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/** Public sample feed so visitors can try reacting, commenting and checking evidence before signing up. */
export default function DemoPage() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [interactions, setInteractions] = useState<DemoInteractionState>(() =>
    initialInteractionState(REELS),
  );
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [desktopTab, setDesktopTab] = useState<PanelTab>("discussion");
  const [hintsOpen, setHintsOpen] = useState(() => !readHintsDismissed());
  const [hintsReady, setHintsReady] = useState(false);
  const [posted, setPosted] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(true);
  const isDesktop = useIsDesktop();
  const onEnd = activeIdx >= REELS.length;
  const active = REELS[Math.min(activeIdx, REELS.length - 1)];
  const activeScene = interactions[active.id];

  const scrollTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(REELS.length, i));
    el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
  }, []);

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
  }, [startScene]);

  useEffect(() => {
    track("feed_open", { demo: true });
  }, []);

  useEffect(() => {
    if (onEnd || !active) return;
    track("reel_open", { demo: true, reelId: active.id, index: activeIdx });
    track("scene_view", { demo: true, reelId: active.id, index: activeIdx });
  }, [active?.id, activeIdx, onEnd, active]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () =>
      setActiveIdx(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!hintsOpen) return;
    const t = window.setTimeout(() => setHintsReady(true), 800);
    return () => window.clearTimeout(t);
  }, [hintsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
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

  const dismissHints = useCallback(() => {
    setHintsOpen(false);
    persistHintsDismissed();
  }, []);

  const openPanel = useCallback(
    (tab: PanelTab) => {
      dismissHints();
      if (tab === "evidence") {
        track("evidence_open", {
          demo: true,
          reelId: REELS[Math.min(activeIdx, REELS.length - 1)]?.id,
        });
      }
      if (isDesktop) setDesktopTab(tab);
      else setPanel(tab);
    },
    [dismissHints, isDesktop, activeIdx],
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
      setPosted(true);
      setNudgeOpen(true);
    },
    [],
  );

  const feedReel = useMemo(
    () => (activeScene ? toFeedReel(active, activeScene) : null),
    [active, activeScene],
  );

  const showHints = hintsOpen && hintsReady && activeIdx === 0 && !onEnd;
  const panelProps =
    feedReel && activeScene
      ? {
          reel: feedReel,
          comments: activeScene.comments,
          onAddComment: addComment,
          findings: active.findings,
          discussionFooter:
            posted && nudgeOpen ? (
              <WorkspaceNudge onDismiss={() => setNudgeOpen(false)} />
            ) : undefined,
        }
      : null;

  return (
    <div className="flex h-dvh bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col items-center bg-[#04070E]">
        <div className="absolute inset-x-0 top-0 z-30 mx-auto flex items-center justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent px-3 py-3 lg:max-w-[calc(100dvh*9/16)]">
          <Link
            to="/"
            aria-label="Back to repofeed.ai"
            className="flex min-w-0 cursor-pointer items-center gap-2 text-white"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <Logo withText={false} />
            <span className="truncate text-sm font-semibold">Demo feed</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/demo/insights"
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-black/40 px-3 text-xs font-semibold text-white backdrop-blur hover:bg-black/60 lg:hidden"
            >
              <BarChart3 className="size-3.5" /> Insights
            </Link>
            <span className="rounded-full bg-black/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
              {onEnd ? "Done" : `${activeIdx + 1} / ${REELS.length}`}
            </span>
          </div>
        </div>
        <div
          ref={scrollerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none lg:max-w-[calc(100dvh*9/16)]"
          aria-label="Demo scene feed. Use arrow keys or J and K to move."
        >
          {REELS.map((r, i) => {
            const scene = interactions[r.id];
            return (
              <div key={r.key} className="h-full w-full">
                <DemoSlide
                  reel={r}
                  mounted={Math.abs(i - activeIdx) <= 1}
                  active={i === activeIdx}
                  onEnded={() => scrollTo(i + 1)}
                  hearted={scene?.hearted ?? false}
                  hearts={scene?.hearts ?? 0}
                  saved={scene?.saved ?? false}
                  commentCount={scene?.comments.length ?? 0}
                  onHeart={() => {
                    setInteractions((s) => toggleHeart(s, r.id));
                    track("heart", { demo: true, reelId: r.id });
                  }}
                  onSave={() => {
                    setInteractions((s) => toggleSave(s, r.id));
                    track("save", { demo: true, reelId: r.id });
                  }}
                  onOpenPanel={openPanel}
                  showHints={showHints && i === 0}
                  onDismissHints={dismissHints}
                />
              </div>
            );
          })}
          <EndCard onRestart={() => scrollTo(0)} />
        </div>
        {activeIdx === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.4, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-6 left-4 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
          >
            <ArrowDown className="size-3.5" /> Scroll for the next scene
          </motion.div>
        )}
      </div>

      {isDesktop && panelProps && (
        <aside className="hidden w-[380px] shrink-0 flex-col border-l border-border lg:flex">
          <ReelPanel
            {...panelProps}
            tab={desktopTab}
            onTab={setDesktopTab}
            className="min-h-0 flex-1"
          />
          <div className="space-y-2 border-t border-border p-4">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="h-10 w-full font-semibold"
            >
              <Link to="/demo/insights">
                <BarChart3 className="size-4" /> See the Insights dashboard
              </Link>
            </Button>
            <SignInButton
              size="sm"
              className="h-10 w-full font-semibold"
              signInText="Make your own, free"
            />
          </div>
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
              aria-label="Scene discussion and evidence"
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
  );
}

function WorkspaceNudge({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          In your workspace, your team sees this.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
      <SignInButton
        size="sm"
        className="mt-3 h-9 font-semibold"
        signInText="Make your own, free"
      />
    </div>
  );
}

function EndCard({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex h-full w-full snap-start flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,rgba(47,155,255,0.25),transparent_60%)] px-8 text-center">
      <Logo />
      <h2 className="text-balance font-display text-3xl font-extrabold text-white">
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
      <Button asChild variant="secondary" className="h-11">
        <Link to="/demo/insights">
          <BarChart3 className="size-4" /> See who watched, in Insights
        </Link>
      </Button>
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
