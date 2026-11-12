import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jsonAuthHeaders } from "@/lib/api/bearer";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Expand, Presentation, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { getErrorMessage } from "@/lib/errors";
import PermissionDenied from "@/components/permission-denied.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useReducedMotion } from "@/hooks/use-reduced-motion.ts";
import { cn } from "@/lib/utils.ts";
import { toastError } from "@/lib/errors.ts";
import Slide from "./_components/slide.tsx";
import { SLIDE_H, SLIDE_W, isLegacyDeck, type Deck } from "./_lib/deck.ts";
import { useElementSize } from "./_lib/use-element-size.ts";

/** Database rows are snake_case; the slides and the PowerPoint export read camelCase. */
function toDeck(row: Record<string, unknown>): Deck {
  const stats = (row.stats ?? {}) as Partial<Deck["stats"]>;
  return {
    ...row,
    id: String(row.id),
    _id: String(row.id),
    _creationTime: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
    scopeLabel: String(row.scope_label ?? "Research readout"),
    slides: Array.isArray(row.slides) ? (row.slides as Deck["slides"]) : [],
    reels: Array.isArray(row.reels) ? (row.reels as Deck["reels"]) : [],
    stats: {
      reached: stats.reached ?? 0,
      memberCount: stats.memberCount ?? 0,
      guestsReached: stats.guestsReached ?? 0,
      completionRate: stats.completionRate ?? 0,
      openItems: stats.openItems ?? 0,
      totalViews: stats.totalViews ?? 0,
      reactions: { true: 0, surprised: 0, pushback: 0, ...(stats.reactions ?? {}) },
    },
  };
}

export default function DeckPage() {
  const { current, isEditor } = useWorkspace();
  const [params] = useSearchParams();
  const studyId = params.get("study") ?? undefined;
  
  const queryClient = useQueryClient();
  const deckKey = ['decks', 'latest', current?._id, studyId];
  const { data: deck } = useQuery({
    queryKey: deckKey,
    queryFn: async (): Promise<Deck | null> => {
      if (!current?._id) return null;
      const { supabase } = await import('@/lib/supabase');
      const query = supabase
        .from('decks')
        .select('*')
        .eq('workspace_id', current._id)
        // A deck made from Insights for "all studies" is stored under the scope "all".
        .eq('scope', studyId ?? 'all')
        .order('created_at', { ascending: false })
        .limit(1);
      const { data } = await query.maybeSingle();
      return data ? toDeck(data as Record<string, unknown>) : null;
    },
    enabled: !!(current && isEditor),
  });

  const [busy, setBusy] = useState(false);
  const backTo = studyId ? `/insights?study=${studyId}` : "/insights";

  const run = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const response = await fetch('/api/decks/generate', {
        method: 'POST',
        // The route checks who is asking; without the token it always answered "not authenticated".
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({ workspaceId: current._id, studyId }),
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(error?.error || "Couldn't create the deck. Try again.");
      }
      await queryClient.invalidateQueries({ queryKey: ['decks'] });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create the deck. Try again."));
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;
  if (!isEditor) return <PermissionDenied what="create slide decks" />;

  return (
    <div className="dark flex h-dvh flex-col bg-background">
      {deck === undefined ? (
        <div className="flex flex-1 items-center justify-center p-6"><Skeleton className="aspect-video w-full max-w-5xl rounded-2xl" /></div>
      ) : busy ? (
        <Generating backTo={backTo} />
      ) : deck === null ? (
        <div className="flex flex-1 flex-col">
          <TopBar backTo={backTo} />
          <Empty className="m-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Presentation /></EmptyMedia>
              <EmptyTitle>Turn {studyId ? "this study" : "your published studies"} into a readout deck</EmptyTitle>
              <EmptyDescription>You get a short deck of findings, each backed by a quote or a figure from your scenes, plus recommendations. Present it here or download it as an editable PowerPoint file.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="h-11" onClick={() => void run()}><Sparkles className="size-4" /> Generate deck</Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <Presenter key={deck._id} deck={deck} backTo={backTo} onRegenerate={() => void run()} />
      )}
    </div>
  );
}

function TopBar({ backTo, children }: { backTo: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-5">
      <Button asChild variant="ghost" className="h-10 px-2 sm:px-3">
        <Link to={backTo}><ArrowLeft className="size-4" /> <span className="hidden sm:inline">Insights</span></Link>
      </Button>
      <div className="flex-1" />
      {children}
    </header>
  );
}

const STEPS = ["Reading the study findings", "Checking figures and quotes", "Writing the story", "Laying out the slides"];

export function Generating({ backTo }: { backTo: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar backTo={backTo} />
      <div className="m-auto flex flex-col items-center gap-5 p-6 text-center">
        <Spinner className="size-8 text-primary" />
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="font-display text-xl font-bold"
          >
            {STEPS[step]}…
          </motion.p>
        </AnimatePresence>
        <p className="max-w-xs text-sm text-muted-foreground">This usually takes under a minute.</p>
      </div>
    </div>
  );
}

export function Presenter({ deck, backTo, onRegenerate, extra }: { deck: Deck; backTo: string; onRegenerate: () => void; extra?: React.ReactNode }) {
  const [params] = useSearchParams();
  // `?slide=N` (1-based) opens a specific slide, handy for sharing a link to one point.
  const [index, setIndex] = useState(() => Math.max(0, Math.min(deck.slides.length - 1, Number(params.get("slide") ?? 1) - 1 || 0)));
  const [downloading, setDownloading] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(stageRef);
  const reduced = useReducedMotion();
  const total = deck.slides.length;
  const scale = size.width ? Math.min(size.width / SLIDE_W, size.height / SLIDE_H) : 0;

  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(total - 1, i + d))), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const touchX = useRef<number | null>(null);

  const download = async () => {
    setDownloading(true);
    try {
      const { exportPptx } = await import("./_lib/export-pptx.ts");
      await exportPptx(deck);
    } catch {
      toast.error("Couldn't build the PowerPoint file. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => toast.error("Full screen isn't available here."));
  };

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col bg-background">
      <TopBar backTo={backTo}>
        <Button variant="ghost" className="h-10 px-2 sm:px-3" onClick={onRegenerate} aria-label="Create a new version">
          <RotateCcw className="size-4" /> <span className="hidden sm:inline">Generate again</span>
        </Button>
        <Button variant="secondary" className="h-10" onClick={() => void download()} disabled={downloading}>
          {downloading ? <Spinner /> : <Download className="size-4" />} <span className="hidden sm:inline">PowerPoint</span><span className="sm:hidden">.pptx</span>
        </Button>
        <Button className="hidden h-10 sm:inline-flex" onClick={fullscreen}><Expand className="size-4" /> Present</Button>
        {extra}
      </TopBar>

      {isLegacyDeck(deck) && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-primary/10 px-4 py-2 text-sm">
          <span>This deck was made with the old format, which focused on views instead of what the study found.</span>
          <Button size="sm" className="h-8" onClick={onRegenerate}><Sparkles className="size-4" /> Rebuild from findings</Button>
        </div>
      )}

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {scale > 0 && (
          <div className="absolute left-1/2 top-1/2" style={{ width: SLIDE_W, height: SLIDE_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={reduced ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-border"
              >
                <Slide deck={deck} slide={deck.slides[index]} index={index} total={total} animate={!reduced} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
        <button type="button" aria-label="Previous slide" onClick={() => go(-1)} disabled={index === 0} className="absolute inset-y-0 left-0 w-1/5 cursor-pointer disabled:cursor-default" />
        <button type="button" aria-label="Next slide" onClick={() => go(1)} disabled={index === total - 1} className="absolute inset-y-0 right-0 w-1/5 cursor-pointer disabled:cursor-default" />
      </div>

      <nav className="flex items-center justify-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <Button variant="secondary" size="icon" className="size-10" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide"><ChevronLeft className="size-5" /></Button>
        <div className="flex max-w-[60vw] items-center gap-1.5 overflow-x-auto">
          {deck.slides.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}: ${s.headline}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="grid h-6 cursor-pointer place-items-center px-0.5"
            >
              <span className={cn("block h-1.5 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground")} />
            </button>
          ))}
        </div>
        <Button variant="secondary" size="icon" className="size-10" onClick={() => go(1)} disabled={index === total - 1} aria-label="Next slide"><ChevronRight className="size-5" /></Button>
      </nav>
    </div>
  );
}
