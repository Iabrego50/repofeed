import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, GraduationCap, X } from "lucide-react";
import { api } from "@/lib/api/complete";
import { track } from "@/lib/analytics";
import { useUser } from "@/hooks/use-auth.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import {
  LESSONS,
  finishLesson,
  lessonToOffer,
  nextLessonAfter,
  readGuide,
  registerVisit,
  resolveRoute,
  writeGuide,
  type GuideLesson,
  type GuideState,
} from "@/lib/guide.ts";

/** Lets the sidebar (or anything else) reopen the guide. */
export const OPEN_GUIDE_EVENT = "repofeed:open-guide";
export function openGuide() {
  window.dispatchEvent(new Event(OPEN_GUIDE_EVENT));
}

type Box = { top: number; left: number; width: number; height: number };
const CARD_W = 340;
const GAP = 14;

/** The first element carrying this `data-tour` name that is actually on screen (desktop and phone use different ones). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

function placeCard(box: Box | null, cardH: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 24);
  const clampX = (x: number) => Math.max(12, Math.min(vw - width - 12, x));
  const clampY = (y: number) => Math.max(12, Math.min(vh - cardH - 12, y));
  if (!box) return { top: clampY(vh - cardH - 96), left: clampX((vw - width) / 2) };
  // Beside the target when there is room (sidebar items), otherwise under or over it.
  if (box.left + box.width + GAP + width <= vw - 12) return { top: clampY(box.top), left: box.left + box.width + GAP };
  if (box.top + box.height + GAP + cardH <= vh - 12) return { top: box.top + box.height + GAP, left: clampX(box.left) };
  if (box.top - GAP - cardH >= 12) return { top: box.top - GAP - cardH, left: clampX(box.left) };
  return { top: clampY(vh - cardH - 96), left: clampX((vw - width) / 2) };
}

function Tour({ lesson, publishedStudyId, onClose }: { lesson: GuideLesson; publishedStudyId: string | null; onClose: (finished: boolean) => void }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const stop = lesson.stops[index];
  const route = resolveRoute(stop, publishedStudyId);
  const here = `${pathname}${search}`;

  useEffect(() => {
    if (here !== route && pathname !== route) navigate(route);
  }, [route, here, pathname, navigate]);

  // The target may render a moment after the route changes, so look for it a few times, then keep tracking it.
  useEffect(() => {
    let tries = 0;
    const measure = () => {
      const el = findTarget(stop.target);
      if (!el) {
        setBox(null);
        return false;
      }
      const rect = el.getBoundingClientRect();
      setBox({ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 });
      return true;
    };
    measure();
    const poll = window.setInterval(() => {
      tries += 1;
      if (measure() && tries > 12) window.clearInterval(poll);
      if (tries > 40) window.clearInterval(poll);
    }, 150);
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [stop.target, pathname]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, box]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const last = index === lesson.stops.length - 1;
  const next = useCallback(() => (last ? onClose(true) : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, back, onClose]);

  const pos = placeCard(box, cardH);

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* Dims everything except the thing being explained, and swallows stray clicks while the tour runs. */}
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-mark transition-all duration-200 motion-reduce:transition-none"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 200vmax rgb(16 21 31 / 0.55)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgb(16_21_31_/_0.55)]" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-body"
        tabIndex={-1}
        className="absolute rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lift outline-none transition-[top,left] duration-200 motion-reduce:transition-none"
        style={{ top: pos.top, left: pos.left, width: Math.min(CARD_W, window.innerWidth - 24) }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {lesson.title}, stop {index + 1} of {lesson.stops.length}
          </p>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="End the tour"
            className="-mr-1 grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 id="guide-title" className="mt-1 text-base font-bold tracking-tight">{stop.title}</h2>
        <p id="guide-body" aria-live="polite" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stop.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {lesson.stops.map((s, i) => (
              <span key={s.id} className={cn("h-1 w-5 rounded-full", i <= index ? "bg-foreground" : "bg-border")} />
            ))}
          </div>
          {index > 0 && (
            <Button type="button" variant="ghost" className="h-9" onClick={back}>Back</Button>
          )}
          <Button type="button" className="h-9 font-semibold" onClick={next}>{last ? "Done" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mounted once inside the app shell for editors. Offers one lesson per visit
 * in a centred dialog, runs it as a spotlight tour, and stays out of the way otherwise.
 */
export default function Guide() {
  const { user } = useUser();
  const { current, isEditor } = useWorkspace();
  const [state, setState] = useState<GuideState | null>(null);
  const [running, setRunning] = useState<GuideLesson | null>(null);
  const [snoozed, setSnoozed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [justFinished, setJustFinished] = useState<GuideLesson | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    // Reading browser storage has to happen after mount; this runs once per user.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(registerVisit(userId));
  }, [userId]);

  useEffect(() => {
    const onOpen = () => {
      setMenu(true);
      setSnoozed(false);
      setJustFinished(null);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpen);
  }, []);

  const { data: studies } = useQuery({
    queryKey: ["studies", "list", current?._id],
    queryFn: () => api.studies.list({ workspaceId: current!._id }),
    enabled: !!current && isEditor && (!!running || menu),
    staleTime: 60_000,
  });
  const publishedStudyId = useMemo(() => studies?.find((s) => s.status === "published")?._id ?? null, [studies]);

  const save = useCallback(
    (next: GuideState) => {
      setState(next);
      if (userId) writeGuide(userId, next);
    },
    [userId],
  );

  if (!isEditor || !state) return null;

  const start = (lesson: GuideLesson) => {
    setMenu(false);
    setJustFinished(null);
    setRunning(lesson);
    track("onboarding_completed", { stage: "lesson_started", lesson: lesson.id });
  };

  const close = (finished: boolean) => {
    const lesson = running;
    setRunning(null);
    if (!lesson) return;
    if (finished) {
      save(finishLesson(state, lesson.id));
      setJustFinished(lesson);
      track("onboarding_completed", { stage: "lesson_finished", lesson: lesson.id });
    } else {
      setSnoozed(true);
    }
  };

  if (running) return <Tour lesson={running} publishedStudyId={publishedStudyId} onClose={close} />;

  const offer = lessonToOffer(state);
  const shell = "fixed bottom-20 right-4 z-40 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lift lg:bottom-5 lg:right-5";

  if (menu) {
    return (
      <Dialog open onOpenChange={(open) => !open && setMenu(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-xl">Product tour</DialogTitle>
          <DialogDescription>Three short lessons. Pick one to start, or replay one you’ve done.</DialogDescription>
          <ul className="space-y-1">
            {LESSONS.map((lesson, i) => {
              const done = state.done.includes(lesson.id);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => start(lesson)}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 text-left hover:border-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-success text-white" : "border border-border text-muted-foreground")}>
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{lesson.title}</span>
                      <span className="block text-sm text-muted-foreground">{lesson.blurb}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    );
  }

  if (justFinished) {
    const upcoming = nextLessonAfter(justFinished.id);
    return (
      <section aria-label="Product tour" role="status" className={shell}>
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="grid size-5 place-items-center rounded-full bg-success text-white"><Check className="size-3" strokeWidth={3} /></span>
          That’s “{justFinished.title}”
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {upcoming
            ? `Next time you sign in: ${upcoming.title.toLowerCase()}. Or take it now.`
            : "You’ve seen the whole app. The tour stays under Help if you want it again."}
        </p>
        <div className="mt-3 flex gap-2">
          {upcoming && <Button type="button" variant="outline" className="h-9" onClick={() => start(upcoming)}>Take it now</Button>}
          <Button type="button" variant="ghost" className="h-9" onClick={() => setJustFinished(null)}>Close</Button>
        </div>
      </section>
    );
  }

  if (!offer || snoozed) return null;
  const number = LESSONS.indexOf(offer) + 1;

  return (
    <Dialog open onOpenChange={(open) => !open && setSnoozed(true)}>
      <DialogContent className="sm:max-w-md">
        <span className="grid size-11 place-items-center rounded-full bg-mark text-mark-foreground">
          <GraduationCap className="size-5" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">Tour, part {number} of {LESSONS.length}</p>
        <DialogTitle className="text-balance text-2xl">
          {number === 1 ? "New here? Take a one-minute look around" : `Welcome back. Today: ${offer.title.toLowerCase()}`}
        </DialogTitle>
        <DialogDescription className="text-[0.9375rem]">
          {offer.blurb} {offer.stops.length} stops, and you can leave at any point.
        </DialogDescription>
        <ol className="space-y-1.5 text-sm">
          {offer.stops.map((stop, i) => (
            <li key={stop.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
              {stop.title}
            </li>
          ))}
        </ol>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" className="h-10 px-5 font-semibold" onClick={() => start(offer)}>Show me</Button>
          <Button type="button" variant="outline" className="h-10" onClick={() => setSnoozed(true)}>Not now</Button>
          <Button type="button" variant="ghost" className="ml-auto h-10 text-muted-foreground" onClick={() => save({ ...state, off: true })}>
            Don’t show again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
