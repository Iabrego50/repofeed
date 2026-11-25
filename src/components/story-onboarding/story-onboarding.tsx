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
  ChannelPhoneVisual,
  ChannelPreviewCard,
  CrtTvVisual,
  ScatteredFilesVisual,
  YellowScreenVisual,
} from "./story-visuals.tsx";
import "./story-onboarding.css";

const SEGMENT_MS = 10000;

type StepKind = "story" | "question" | "finish";
type Theme = "dark" | "light";

type Step = {
  id: string;
  kind: StepKind;
  theme: Theme;
  eyebrow: string;
  title: string;
  body: string;
  cta?: string;
  visual?: "crt" | "yellow" | "scattered" | "phone" | "preview" | "ready";
  question?: "role" | "research" | "share" | "channel";
  channelStep?: number;
};

/**
 * Design screens 01–06, plus intermediate channel questions (research / share / name)
 * so we still persist the answers the product needs.
 */
const STEPS: Step[] = [
  {
    id: "then",
    kind: "story",
    theme: "dark",
    eyebrow: "Then",
    title: "Remember 8pm?",
    body: "One channel. One story. Families, offices, whole cities tuned in together, and had one conversation about it the next morning.",
    cta: "Turn it on",
    visual: "crt",
  },
  {
    id: "now",
    kind: "story",
    theme: "dark",
    eyebrow: "Now",
    title: "Then everyone got their own screen.",
    body: "Streaming built a private bubble for every person. Infinite choice, zero common plot. (Ask anyone what they watched last night.)",
    cta: "Change the channel",
    visual: "yellow",
  },
  {
    id: "cost",
    kind: "story",
    theme: "dark",
    eyebrow: "The cost",
    title: "Your research went the same way.",
    body: "Interviews, surveys, decks. All filed, none watched. Somewhere in there is the quote that should have changed the roadmap. Go find it.",
    cta: "I'd rather not dig",
    visual: "scattered",
  },
  {
    id: "channel",
    kind: "story",
    theme: "light",
    eyebrow: "repofeed",
    title: "Now it plays like a channel.",
    body: "That buried interview file? Here it is as a short insight scene. One common feed, everyone scrolls the same findings. Go on, react to it.",
    cta: "Build my channel",
    visual: "phone",
  },
  {
    id: "role",
    kind: "question",
    theme: "light",
    eyebrow: "Your channel · 1 of 4",
    title: "Who’s holding the remote?",
    body: "Pick your role. We’ll tune the channel’s language to how you work.",
    cta: "Continue",
    question: "role",
    visual: "preview",
    channelStep: 1,
  },
  {
    id: "research",
    kind: "question",
    theme: "light",
    eyebrow: "Your channel · 2 of 4",
    title: "What’s on air?",
    body: "Pick the research you work with. We’ll label scenes so the feed feels familiar.",
    cta: "Continue",
    question: "research",
    visual: "preview",
    channelStep: 2,
  },
  {
    id: "share",
    kind: "question",
    theme: "light",
    eyebrow: "Your channel · 3 of 4",
    title: "Who’s watching?",
    body: "Start small or go wide — you invite people when you’re ready.",
    cta: "Continue",
    question: "share",
    visual: "preview",
    channelStep: 3,
  },
  {
    id: "name",
    kind: "question",
    theme: "light",
    eyebrow: "Your channel · 4 of 4",
    title: "Name the channel.",
    body: "A short name your teammates will recognize in the feed.",
    cta: "Continue",
    question: "channel",
    visual: "preview",
    channelStep: 4,
  },
  {
    id: "ready",
    kind: "finish",
    theme: "light",
    eyebrow: "Ready",
    title: "You're on air.",
    body: "Research, as a feed. Upload your first study, or watch the demo to see insight scenes in motion.",
    visual: "ready",
  },
];

function Chip({
  selected,
  children,
  onClick,
  dark,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected
          ? dark
            ? "border-white bg-white text-[#0b1020]"
            : "border-foreground bg-foreground text-background"
          : dark
            ? "border-white/25 bg-transparent text-white hover:border-white/50"
            : "border-border bg-card text-foreground hover:border-foreground/40",
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
  light,
}: {
  index: number;
  count: number;
  paused: boolean;
  reduced: boolean;
  onSegmentEnd: () => void;
  light?: boolean;
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
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      aria-label="Story progress"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn("h-0.5 flex-1 overflow-hidden rounded-full", light ? "bg-foreground/15" : "bg-white/20")}
        >
          <div
            key={i === index ? `fill-${tick}` : `seg-${i}`}
            className={cn(
              "h-full rounded-full",
              light ? "bg-foreground" : "bg-white",
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
 * Full-screen story onboarding matching Isaac’s design screens:
 * two-column desktop layout, mono eyebrows, navy / paper / blue / yellow.
 */
export default function StoryOnboarding({ preview = false, replay = false, onFinished }: StoryOnboardingProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const { nativeViewerMode } = useNativeViewer();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<StoryAnswers>(() =>
    user
      ? {
          ...emptyStoryAnswers(),
          ...readStoryAnswers(user),
          channelName: readStoryAnswers(user).channelName || suggestChannelName(user.email),
        }
      : emptyStoryAnswers(),
  );
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = STEPS[index]!;
  const isQuestion = step.kind === "question";
  const isFinish = step.kind === "finish";
  const light = step.theme === "light";

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

  const go = useCallback((delta: number) => {
    setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));
  }, []);

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
        navigate(
          destination === "demo" ? "/demo" : "/signin?returnTo=/studies/new",
          { replace: true },
        );
        return;
      }
      const needsTeam = !workspaces || workspaces.length === 0;
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
        return <CrtTvVisual reduced={reduced} onActivate={next} />;
      case "yellow":
        return <YellowScreenVisual reduced={reduced} onActivate={next} />;
      case "scattered":
        return <ScatteredFilesVisual reduced={reduced} onActivate={next} />;
      case "phone":
        return <ChannelPhoneVisual reduced={reduced} />;
      case "preview":
        return <ChannelPreviewCard answers={answers} status="setting" />;
      case "ready":
        return <ChannelPreviewCard answers={answers} status="air" showNext />;
      default:
        return null;
    }
  })();

  return (
    <div
      className={cn(
        "relative flex h-dvh flex-col overflow-hidden",
        light ? "bg-paper text-foreground" : "dark bg-studio text-foreground",
      )}
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
      <header className="relative z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
        <ProgressBars
          index={index}
          count={STEPS.length}
          paused={paused || isQuestion || isFinish}
          reduced={reduced}
          onSegmentEnd={next}
          light={light}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <Logo className={light ? undefined : "text-white"} />
          <button
            type="button"
            onClick={() => void skip()}
            className={cn(
              "cursor-pointer text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              light ? "text-foreground/70 hover:text-foreground" : "text-white/70 hover:text-white",
            )}
          >
            Skip the story
          </button>
        </div>
      </header>

      <div className="relative z-0 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:px-8 lg:flex-row lg:items-center lg:gap-12 lg:pt-4">
        <div className="relative z-20 flex w-full flex-none flex-col lg:max-w-[42%] lg:flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${step.id}`}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-eyebrow uppercase">
                {step.eyebrow}
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className={cn(
                  "mt-3 text-balance text-3xl font-bold leading-[1.1] tracking-tight outline-none sm:text-4xl lg:text-[2.75rem]",
                  light ? "text-foreground" : "text-white",
                )}
              >
                {step.title}
              </h1>
              <p
                className={cn(
                  "mt-3 max-w-prose text-pretty text-base leading-relaxed",
                  light ? "text-muted-foreground" : "text-white/70",
                )}
              >
                {step.body}
              </p>

              {step.id === "cost" && (
                <p className={cn("mt-3 text-sm font-medium", light ? "text-foreground" : "text-white/90")}>
                  Five files. Tap one to start digging.
                </p>
              )}

              {step.question === "role" && (
                <div className="mt-6 flex flex-wrap gap-2">
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
                <div className="mt-6 flex flex-wrap gap-2">
                  {STORY_RESEARCH_KINDS.map((kind) => (
                    <Chip key={kind} selected={answers.researchKinds.includes(kind)} onClick={() => toggleKind(kind)}>
                      {RESEARCH_LABELS[kind]}
                    </Chip>
                  ))}
                </div>
              )}

              {step.question === "share" && (
                <div className="mt-6 flex flex-wrap gap-2">
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
                <div className="mt-6 space-y-2">
                  <label htmlFor="story-channel" className="sr-only">
                    Channel name
                  </label>
                  <Input
                    id="story-channel"
                    value={answers.channelName}
                    onChange={(e) => setAnswers((a) => ({ ...a, channelName: e.target.value }))}
                    maxLength={60}
                    className="h-12 border-border bg-card"
                    placeholder={suggestChannelName(user?.email)}
                    autoComplete="organization"
                  />
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-2">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-11 px-5 font-semibold",
                      !light && "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white",
                    )}
                    onClick={back}
                  >
                    Back
                  </Button>
                )}
                {isFinish ? (
                  <>
                    <Button
                      type="button"
                      className="h-11 px-5 font-semibold"
                      disabled={busy}
                      onClick={() =>
                        void finish(preview || (workspaces && workspaces.length > 0) ? "upload" : "setup")
                      }
                    >
                      {preview
                        ? "Sign in to upload"
                        : workspaces && workspaces.length > 0
                          ? "Upload research"
                          : "Set up workspace"}
                    </Button>
                    <Button
                      type="button"
                      className={cn(
                        "h-11 px-5 font-semibold",
                        light
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "bg-white text-[#0b1020] hover:bg-white/90",
                      )}
                      disabled={busy}
                      onClick={() => void finish("demo")}
                    >
                      Watch the demo
                    </Button>
                  </>
                ) : (
                  <Button type="button" className="h-11 px-5 font-semibold" disabled={!canAdvance} onClick={next}>
                    {step.cta ?? "Continue"}
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative mt-8 flex min-h-0 flex-1 items-center justify-center lg:mt-0">
          {!isQuestion && !isFinish && step.visual !== "crt" && step.visual !== "yellow" && step.visual !== "scattered" && (
            <div className="absolute inset-0 z-10 hidden lg:flex">
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
              className="relative z-0 flex h-full w-full items-center justify-center"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              {visual}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {(preview || replay) && (
        <p
          className={cn(
            "relative z-20 px-5 pb-4 text-xs sm:px-8",
            light ? "text-muted-foreground" : "text-white/40",
          )}
        >
          {preview
            ? "Preview mode. Answers aren't saved until you sign in."
            : "Replaying the product story. Finish to update your answers."}
        </p>
      )}
    </div>
  );
}
