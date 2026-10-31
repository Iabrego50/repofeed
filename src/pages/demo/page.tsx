import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowDown, ArrowLeft, BarChart3, FileText, Quote, RotateCcw } from "lucide-react";
import { DEMO_REELS, DEMO_TRACKS } from "@/convex/lib/demoReels.ts";
import { SAMPLE_STUDY } from "@/convex/lib/sample.ts";
import type { ReelData } from "@/lib/reel/painter.ts";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DemoSlide from "./_components/demo-slide.tsx";

type DemoReel = ReelData & { key: string; sources: string[]; quotes: number };

const REELS: DemoReel[] = DEMO_REELS.map((r) => ({
  key: r.title,
  title: r.title,
  track: DEMO_TRACKS[r.track],
  trackIndex: r.track,
  studyTitle: SAMPLE_STUDY.title,
  scenes: r.scenes,
  footage: r.footage,
  sources: [...new Set(r.findings.map((f) => f.file))],
  quotes: r.findings.length,
}));

/** Public sample feed so visitors can scroll real scenes before signing up. */
export default function DemoPage() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const onEnd = activeIdx >= REELS.length;
  const active = REELS[Math.min(activeIdx, REELS.length - 1)];

  const scrollTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(REELS.length, i));
    el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
  }, []);

  // `?scene=N` (from the demo Insights page) opens the feed at that scene.
  const [params] = useSearchParams();
  const startScene = Number(params.get("scene") ?? 0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !Number.isInteger(startScene) || startScene <= 0 || startScene >= REELS.length) return;
    el.scrollTo({ top: startScene * el.clientHeight });
  }, [startScene]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setActiveIdx(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  return (
    <div className="flex h-dvh bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col items-center bg-[#04070E]">
        <div className="absolute inset-x-0 top-0 z-30 mx-auto flex items-center justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent px-3 py-3 lg:max-w-[calc(100dvh*9/16)]">
          <Link to="/" aria-label="Back to repofeed.ai" className="flex min-w-0 cursor-pointer items-center gap-2 text-white">
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
          {REELS.map((r, i) => (
            <div key={r.key} className="h-full w-full">
              <DemoSlide reel={r} mounted={Math.abs(i - activeIdx) <= 1} active={i === activeIdx} onEnded={() => scrollTo(i + 1)} />
            </div>
          ))}
          <EndCard onRestart={() => scrollTo(0)} />
        </div>
        {activeIdx === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.4, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-6 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
          >
            <ArrowDown className="size-3.5" /> Scroll for the next scene
          </motion.div>
        )}
      </div>
      <aside className="hidden w-[380px] shrink-0 flex-col border-l border-border p-6 lg:flex">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Sample study</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight">{SAMPLE_STUDY.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A made-up meal-kit study: interviews, a churn survey and a diary study, turned into {REELS.length} short scenes by AI.
        </p>
        {!onEnd && (
          <motion.div key={active.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{active.track}</p>
            <p className="mt-1 font-display text-lg font-bold">{active.title}</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Quote className="size-4 text-primary" /> {active.quotes} {active.quotes === 1 ? "finding" : "findings"}, each checked against the files
            </p>
            <ul className="mt-3 space-y-1.5">
              {active.sources.map((s) => (
                <li key={s} className="flex items-center gap-2 truncate font-mono text-xs text-muted-foreground">
                  <FileText className="size-3.5 shrink-0 text-primary" /> {s}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        <div className="mt-auto space-y-3 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">In your workspace, stakeholders react, ask questions and log actions on every scene.</p>
          <Button asChild variant="secondary" size="lg" className="h-11 w-full font-semibold">
            <Link to="/demo/insights"><BarChart3 className="size-4" /> See the Insights dashboard</Link>
          </Button>
          <SignInButton size="lg" className="h-11 w-full font-semibold" signInText="Make your own, free" />
        </div>
      </aside>
    </div>
  );
}

function EndCard({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex h-full w-full snap-start flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,rgba(47,155,255,0.25),transparent_60%)] px-8 text-center">
      <Logo />
      <h2 className="text-balance font-display text-3xl font-extrabold text-white">That's the whole study, in {REELS.length} scenes.</h2>
      <p className="max-w-xs text-sm text-white/70">Drop in your own interviews and surveys, and get a feed like this for your team in minutes.</p>
      <SignInButton size="lg" className="h-12 px-6 text-base font-semibold" signInText="Get started free" />
      <Button asChild variant="secondary" className="h-11">
        <Link to="/demo/insights"><BarChart3 className="size-4" /> See who watched, in Insights</Link>
      </Button>
      <Button variant="ghost" onClick={onRestart} className="h-11 text-white/80 hover:text-white">
        <RotateCcw className="size-4" /> Watch again
      </Button>
    </div>
  );
}
