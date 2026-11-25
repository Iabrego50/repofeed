import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useReducedMotion } from "@/hooks/use-reduced-motion.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { cn } from "@/lib/utils.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { isNativePlatform } from "@/lib/native";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import Logo from "@/components/logo.tsx";
import {
  emptyStoryAnswers,
  hasCompletedStoryOnboarding,
  markStoryOnboardingComplete,
  persistStoryOnboarding,
  readStoryAnswers,
  RESEARCH_LABELS,
  ROLE_LABELS,
  SHARE_LABELS,
  STORY_RESEARCH_KINDS,
  STORY_ROLES,
  STORY_SHARE_AUDIENCES,
  suggestChannelName,
  type StoryAnswers,
  type StoryResearchKind,
  type StoryRole,
  type StoryShareAudience,
} from "@/lib/story-onboarding.ts";
import {
  CrtTvVisual,
  HowItWorksVisual,
  ReadyVisual,
  ReassembleVisual,
  ScatteredFilesVisual,
  ShatterVisual,
} from "./story-visuals.tsx";
import "./story-onboarding.css";

const SEGMENT_MS = 8000;

type StepKind = "story" | "question" | "finish";

type Step = {
  id: string;
  kind: StepKind;
  eyebrow: string;
  title: string;
  body: string;
  visual?: "crt" | "shatter" | "scattered" | "reassemble" | "how" | "ready";
  question?: "role" | "research" | "share" | "channel";
};

const STEPS: Step[] = [
  {
    id: "then",
    kind: "story",
    eyebrow: "Then",
    title: "Everyone watched the same story at 8pm.",
    body: "Programmed TV kept a common narrative. Families, offices, whole cities tuned in together — one channel, one conversation the next morning.",
    visual: "crt",
  },
  {
    id: "now",
    kind: "story",
    eyebrow: "Now",
    title: "Streaming shattered the shared screen.",
    body: "Algorithms built a private bubble for every person. Infinite choice, zero common plot. We stopped watching the same thing.",
    visual: "shatter",
  },
  {
    id: "role",
    kind: "question",
    eyebrow: "About you",
    title: "What’s your role?",
    body: "We’ll tune the channel language to how you work.",
    question: "role",
  },
  {
    id: "cost",
    kind: "story",
    eyebrow: "The cost",
    title: "Research insights scatter into files nobody reads.",
    body: "Interviews, surveys, decks — buried in drives. Teams lose the shared knowledge base that used to live in hallway talk and weekly readouts.",
    visual: "scattered",
  },
  {
    id: "research",
    kind: "question",
    eyebrow: "Your research",
    title: "What kind of research do you work with?",
    body: "Pick all that apply. You can change this later.",
    question: "research",
  },
  {
    id: "repofeed",
    kind: "story",
    eyebrow: "repofeed",
    title: "A curated channel for your team’s research.",
    body: "Short AI insight scenes, one common feed. Everyone scrolls the same findings — likes, comments, and marks “heard this before.”",
    visual: "reassemble",
  },
  {
    id: "share",
    kind: "question",
    eyebrow: "Audience",
    title: "Who should share this channel?",
    body: "Start small or go wide — you invite people when you’re ready.",
    question: "share",
  },
  {
    id: "how",
    kind: "story",
    eyebrow: "How it works",
    title: "Upload → scenes → scroll → PowerPoint.",
    body: "Drop in research. AI writes short insight scenes. Your team scrolls, reacts, and adds the best ones to a deck.",
    visual: "how",
  },
  {
    id: "channel",
    kind: "question",
    eyebrow: "Name it",
    title: "What should we call your channel?",
    body: "A short name your teammates will recognize in the feed.",
    question: "channel",
  },
  {
    id: "ready",
    kind: "finish",
    eyebrow: "Ready",
    title: "Your channel is ready.",
    body: "Research, as a feed. Upload your first study or watch the demo to see insight scenes in motion.",
    visual: "ready",
  },
];

function Chip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card/80 text-foreground hover:border-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ProgressBars({
  index,
  count,
  paused,
  reduced,
  onSegmentEnd,
}: {
  index: number;
  count: number;
  paused: boolean;
  reduced: boolean;
  onSegmentEnd: () => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
  }, [index]);

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setTimeout(onSegmentEnd, SEGMENT_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduced, onSegmentEnd, tick]);

  return (
    <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1} aria-label="Story progress">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
          <div
            key={i === index ? `fill-${tick}` : `seg-${i}`}
            className={cn(
              "h-full rounded-full bg-white",
              i < index && "w-full",
              i > index && "w-0",
              i === index && !reduced && !paused && "story-progress-fill w-full",
              i === index && (reduced || paused) && "w-full",
            )}
            style={i === index && !reduced && !paused ? { animationDuration: `${SEGMENT_MS}ms` } : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export type StoryOnboardingProps = {
  /** Unauthenticated preview — no Supabase writes. */
  preview?: boolean;
  /** Forced replay from settings/help. */
  replay?: boolean;
  onFinished?: (destination: "upload" | "demo" | "home" | "setup") => void;
};

/**
 * Full-screen Instagram-story onboarding: narrative beats, choice chips,
 * keyboard/swipe/tap navigation. Persists answers to auth user_metadata.
 */
export default function StoryOnboarding({ preview = false, replay = false, onFinished }: StoryOnboardingProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const { nativeViewerMode } = useNativeViewer();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<StoryAnswers>(() =>
    user ? { ...emptyStoryAnswers(), ...readStoryAnswers(user), channelName: readStoryAnswers(user).channelName || suggestChannelName(user.email) } : emptyStoryAnswers(),
  );
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = STEPS[index]!;
  const isQuestion = step.kind === "question";
  const isFinish = step.kind === "finish";

  useEffect(() => {
    if (!answers.channelName && user?.email) {
      setAnswers((a) => ({ ...a, channelName: suggestChannelName(user.email) }));
    }
  }, [user?.email, answers.channelName]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const canAdvance = (() => {
    if (step.question === "role") return Boolean(answers.role);
    if (step.question === "research") return answers.researchKinds.length > 0;
    if (step.question === "share") return Boolean(answers.shareAudience);
    if (step.question === "channel") return answers.channelName.trim().length > 0;
    return true;
  })();

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));
    },
    [],
  );

  const next = useCallback(() => {
    if (isFinish) return;
    if (isQuestion && !canAdvance) return;
    go(1);
  }, [canAdvance, go, isFinish, isQuestion]);

  const back = useCallback(() => {
    go(-1);
  }, [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, next]);

  const finish = async (destination: "upload" | "demo" | "home" | "setup") => {
    if (busy) return;
    setBusy(true);
    try {
      if (!preview && user) {
        await persistStoryOnboarding(answers);
      }
      onFinished?.(destination);
      if (onFinished) return;
      if (preview) {
        navigate(destination === "demo" ? "/demo" : "/signin", { replace: true });
        return;
      }
      const needsTeam = !workspaces || workspaces.length === 0;
      // Native phone viewers redeem a short code instead of creating a workspace.
      if (needsTeam && (nativeViewerMode || isNativePlatform())) {
        navigate("/join", { replace: true });
        return;
      }
      if (destination === "setup" || needsTeam) {
        navigate("/welcome?setup=1", { replace: true });
        return;
      }
      if (destination === "upload") navigate("/studies/new", { replace: true });
      else if (destination === "demo") navigate("/demo", { replace: true });
      else navigate(appHomePath(), { replace: true });
    } catch (err) {
      console.error("[story-onboarding] persist failed", err);
      // Still let them through — answers can be re-saved later.
      navigate(preview ? "/signin" : appHomePath(), { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!preview && user && !hasCompletedStoryOnboarding(user)) {
        await markStoryOnboardingComplete();
      }
      if (preview) {
        navigate("/", { replace: true });
        return;
      }
      if (!workspaces || workspaces.length === 0) {
        navigate(nativeViewerMode || isNativePlatform() ? "/join" : "/welcome?setup=1", { replace: true });
        return;
      }
      navigate(appHomePath(), { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const toggleKind = (kind: StoryResearchKind) => {
    setAnswers((a) => {
      const has = a.researchKinds.includes(kind);
      return {
        ...a,
        researchKinds: has ? a.researchKinds.filter((k) => k !== kind) : [...a.researchKinds, kind],
      };
    });
  };

  const visual = (() => {
    switch (step.visual) {
      case "crt":
        return <CrtTvVisual reduced={reduced} />;
      case "shatter":
        return <ShatterVisual reduced={reduced} />;
      case "scattered":
        return <ScatteredFilesVisual reduced={reduced} />;
      case "reassemble":
        return <ReassembleVisual reduced={reduced} />;
      case "how":
        return <HowItWorksVisual reduced={reduced} />;
      case "ready":
        return <ReadyVisual reduced={reduced} channelName={answers.channelName} />;
      default:
        return null;
    }
  })();

  return (
    <div
      className="dark relative flex h-dvh flex-col overflow-hidden bg-[#0a0d13] text-foreground"
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        if (t) touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        const t = e.changedTouches[0];
        touchStart.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) next();
        else back();
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(29,99,224,0.18),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(15,143,138,0.12),transparent_50%)]" />

      <header className="relative z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <ProgressBars
          index={index}
          count={STEPS.length}
          paused={paused || isQuestion || isFinish}
          reduced={reduced}
          onSegmentEnd={next}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Logo className="text-white" />
          <button
            type="button"
            onClick={() => void skip()}
            className="cursor-pointer text-sm font-medium text-white/70 underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Skip
          </button>
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-[1.1] items-center justify-center px-4 pt-2 sm:px-8">
          {/* Tap zones cover only the visual plane so Continue / chips stay clickable. */}
          {!isQuestion && !isFinish && (
            <div className="absolute inset-0 z-10 flex">
              <button type="button" aria-label="Previous" className="w-1/3 cursor-pointer bg-transparent" onClick={back} />
              <button
                type="button"
                aria-label="Pause"
                className="w-1/3 cursor-pointer bg-transparent"
                onPointerDown={() => setPaused(true)}
                onPointerUp={() => setPaused(false)}
                onPointerLeave={() => setPaused(false)}
                onClick={next}
              />
              <button type="button" aria-label="Next" className="w-1/3 cursor-pointer bg-transparent" onClick={next} />
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              className="relative z-0 h-full w-full"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              {visual ?? (
                <div className="mx-auto flex h-full max-h-[320px] w-full max-w-md items-center justify-center">
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center backdrop-blur-sm">
                    <p className="text-sm font-semibold tracking-wide text-white/50 uppercase">{step.eyebrow}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-20 mx-auto w-full max-w-xl flex-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${step.id}`}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{step.eyebrow}</p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-balance font-serif text-2xl leading-tight text-white outline-none sm:text-3xl"
              >
                {step.title}
              </h1>
              <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-white/70 sm:text-base">{step.body}</p>

              {step.question === "role" && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {STORY_ROLES.map((role) => (
                    <Chip
                      key={role}
                      selected={answers.role === role}
                      onClick={() => setAnswers((a) => ({ ...a, role: role as StoryRole }))}
                    >
                      {ROLE_LABELS[role]}
                    </Chip>
                  ))}
                </div>
              )}

              {step.question === "research" && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {STORY_RESEARCH_KINDS.map((kind) => (
                    <Chip key={kind} selected={answers.researchKinds.includes(kind)} onClick={() => toggleKind(kind)}>
                      {RESEARCH_LABELS[kind]}
                    </Chip>
                  ))}
                </div>
              )}

              {step.question === "share" && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {STORY_SHARE_AUDIENCES.map((aud) => (
                    <Chip
                      key={aud}
                      selected={answers.shareAudience === aud}
                      onClick={() => setAnswers((a) => ({ ...a, shareAudience: aud as StoryShareAudience }))}
                    >
                      {SHARE_LABELS[aud]}
                    </Chip>
                  ))}
                </div>
              )}

              {step.question === "channel" && (
                <div className="mt-5 space-y-2">
                  <label htmlFor="story-channel" className="sr-only">
                    Channel name
                  </label>
                  <Input
                    id="story-channel"
                    value={answers.channelName}
                    onChange={(e) => setAnswers((a) => ({ ...a, channelName: e.target.value }))}
                    maxLength={60}
                    className="h-12 border-white/20 bg-white/10 text-white placeholder:text-white/40"
                    placeholder={suggestChannelName(user?.email)}
                    autoComplete="organization"
                  />
                  <p className="text-xs text-white/50">Suggestion from your email — edit freely.</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {index > 0 && (
                  <Button type="button" variant="ghost" className="h-11 text-white/80 hover:bg-white/10 hover:text-white" onClick={back}>
                    Back
                  </Button>
                )}
                {isFinish ? (
                  <>
                    <Button
                      type="button"
                      className="h-11 px-5 font-semibold"
                      disabled={busy}
                      onClick={() => void finish(preview || (workspaces && workspaces.length > 0) ? "upload" : "setup")}
                    >
                      {preview ? "Sign in to upload" : workspaces && workspaces.length > 0 ? "Upload research" : "Set up workspace"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 px-5 font-semibold"
                      disabled={busy}
                      onClick={() => void finish("demo")}
                    >
                      Watch the demo
                    </Button>
                  </>
                ) : (
                  <Button type="button" className="h-11 px-5 font-semibold" disabled={!canAdvance} onClick={next}>
                    Continue
                  </Button>
                )}
              </div>
              {preview && (
                <p className="mt-4 text-xs text-white/45">Preview mode — answers aren’t saved until you sign in.</p>
              )}
              {replay && !preview && (
                <p className="mt-4 text-xs text-white/45">Replaying the product story. Finish to update your answers.</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
