import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useReducedMotion } from "@/hooks/use-reduced-motion.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { cn } from "@/lib/utils.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { isNativePlatform } from "@/lib/native";
import SlopShell, { SlopBrand, SlopPill } from "@/components/slop/slop-shell.tsx";
import {
  emptyStorySession,
  markGuestStoryComplete,
  markStoryOnboardingComplete,
  ROLE_LABELS,
  STORY_AUDIENCES,
  STORY_RESEARCH_KINDS,
  STORY_ROLES,
  suggestChannelName,
  type StoryAudience,
  type StoryResearchKind,
  type StoryRole,
  type StorySession,
} from "@/lib/story-onboarding.ts";
import {
  ChannelPhoneVisual,
  ChannelPreviewCard,
  CrtTvVisual,
  DemoWhatYouGetCard,
  ScatteredFilesVisual,
  YellowScreenVisual,
} from "./story-visuals.tsx";
import StorySignupPlans from "./story-signup-plans.tsx";
import {
  DEMO_EMAIL_ERROR,
  isValidDemoEmail,
  submitDemoRequest,
} from "@/lib/demo-request.ts";
import "./story-onboarding.css";

const SEGMENT_MS = 10000;
const STORY_HISTORY_KEY = "repofeed_story_step";
/** Seven design scenes; build-channel substeps share progress bar 6. */
const PROGRESS_COUNT = 7;
/** Index of the “Set up a demo” step in STEPS (Skip jumps here). */
const DEMO_STEP_INDEX = 4;

type StepKind = "story" | "demo" | "question" | "finish";

type Step = {
  id: string;
  kind: StepKind;
  /** 0–6 for the seven artboard scenes */
  scene: number;
  eyebrow: string;
  /** Title may include markers: *word* → serif emphasis */
  title: string;
  body: string;
  cta?: string;
  visual?: "crt" | "yellow" | "scattered" | "phone" | "demo" | "preview" | "ready";
  question?: "role" | "research" | "audience" | "channel";
};

/**
 * SlopMain scenes 0–6. Demo is scene 4; build-your-channel is four history steps
 * (role → research → audience → name) sharing progress scene 5; On air is scene 6.
 */
const STEPS: Step[] = [
  {
    id: "then",
    kind: "story",
    scene: 0,
    eyebrow: "Then",
    title: "Remember *8pm*?",
    body: "One channel. One story. Families, offices, whole cities tuned in together — and had one conversation about it the next morning.",
    cta: "Keep watching",
    visual: "crt",
  },
  {
    id: "now",
    kind: "story",
    scene: 1,
    eyebrow: "Now",
    title: "Then everyone got their *own* screen.",
    body: "Streaming built a private bubble for every person. Infinite choice — zero common plot. (Ask anyone what they watched last night.)",
    cta: "Change the channel",
    visual: "yellow",
  },
  {
    id: "cost",
    kind: "story",
    scene: 2,
    eyebrow: "The cost",
    title: "Your research went the *same* way.",
    body: "Interviews, surveys, decks — all filed, none watched. Somewhere in there is the quote that should have changed the roadmap. Go find it.",
    cta: "I'd rather not dig",
    visual: "scattered",
  },
  {
    id: "feed",
    kind: "story",
    scene: 3,
    eyebrow: "repofeed",
    title: "Now it plays *like* a *channel*.",
    body: "It's not just a repository — it's a channel. That buried interview file is now a reel of short insight scenes in one common feed. Go on — swipe, like, add one to the deck.",
    cta: "Set up a demo ⚡",
    visual: "phone",
  },
  {
    id: "demo",
    kind: "demo",
    scene: 4,
    eyebrow: "Your demo",
    title: "Want *this* with *your* research?",
    body: "Enter your work email — we’ll set up a demo channel with your team’s own research in it.",
    visual: "demo",
  },
  {
    id: "role",
    kind: "question",
    scene: 5,
    eyebrow: "Your channel · 1 of 4",
    title: "Who's holding *the* *remote*?",
    body: "Pick your role. We'll tune the channel's language to how you work.",
    cta: "Continue",
    question: "role",
    visual: "preview",
  },
  {
    id: "research",
    kind: "question",
    scene: 5,
    eyebrow: "Your channel · 2 of 4",
    title: "What goes *on air*?",
    body: "The research you work with. Pick all that apply. You can change this later.",
    cta: "Continue",
    question: "research",
    visual: "preview",
  },
  {
    id: "audience",
    kind: "question",
    scene: 5,
    eyebrow: "Your channel · 3 of 4",
    title: "Who's *watching*?",
    body: "Start small or go wide — you invite people when you're ready.",
    cta: "Continue",
    question: "audience",
    visual: "preview",
  },
  {
    id: "name",
    kind: "question",
    scene: 5,
    eyebrow: "Your channel · 4 of 4",
    title: "Name the *channel*.",
    body: "Something short your teammates will recognize in the feed.",
    cta: "Put it on air 🚀",
    question: "channel",
    visual: "preview",
  },
  {
    id: "ready",
    kind: "finish",
    scene: 6,
    eyebrow: "Ready",
    title: "You're *on air*.",
    body: "Research, as a feed. Upload your first study — or watch the demo to see insight scenes in motion.",
    visual: "ready",
  },
];

function Title({ text }: { text: string }) {
  // Keep non-emphasis text as raw nodes so accessible names keep spaces
  // (wrapping every segment in <span> can glue "Remember"+"8pm" → "Remember8pm").
  // First *word* uses underline-cyan (artboard “this”); later *word* uses serif hot (“your”).
  const parts = text.split(/(\*[^*]+\*)/g);
  let emphasis = 0;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*")) {
          const n = emphasis++;
          const inner = part.slice(1, -1);
          if (n === 0 && text.includes("*this*")) {
            return (
              <span key={i} className="slop-underline slop-underline-cyan">
                {inner}
              </span>
            );
          }
          return (
            <span key={i} className="slop-serif-emphasis slop-text-gradient-hot">
              {inner}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

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
        "slop-btn",
        selected ? "slop-btn-primary" : "slop-btn-ghost",
        "min-h-11 rounded-full px-4 text-sm font-semibold",
      )}
    >
      {children}
    </button>
  );
}

export type StoryOnboardingProps = {
  preview?: boolean;
  replay?: boolean;
  onFinished?: (destination: "upload" | "demo" | "home" | "setup") => void;
};

/**
 * Full-screen product story (web). Matches SlopMain artboards; pricing stays on
 * the finish step. Native viewer onboarding is a separate component.
 */
export default function StoryOnboarding({ preview = false, replay = false, onFinished }: StoryOnboardingProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const { nativeViewerMode } = useNativeViewer();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(() => {
    // Preview-only deep link for screenshots / harness (?storyStep=role|demo|ready|0–N).
    if (!preview || typeof window === "undefined") return 0;
    const raw = new URLSearchParams(window.location.search).get("storyStep");
    if (!raw) return 0;
    const byId = STEPS.findIndex((s) => s.id === raw);
    if (byId >= 0) return byId;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(STEPS.length - 1, Math.max(0, n)) : 0;
  });
  const [session, setSession] = useState<StorySession>(() => ({
    ...emptyStorySession(),
    channelName: suggestChannelName(user?.email),
  }));
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoError, setDemoError] = useState("");
  const [demoSent, setDemoSent] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = STEPS[index]!;
  const isQuestion = step.kind === "question";
  const isDemo = step.kind === "demo";
  const isFinish = step.kind === "finish";
  const showPricing = isFinish && preview && !isNativePlatform();
  const scrollableStep = isQuestion || isFinish || isDemo;
  const showSkip = index < DEMO_STEP_INDEX;

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  useEffect(() => {
    try {
      window.history.replaceState({ ...window.history.state, [STORY_HISTORY_KEY]: 0 }, "");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const raw = (event.state as Record<string, unknown> | null)?.[STORY_HISTORY_KEY];
      if (typeof raw === "number" && raw >= 0 && raw < STEPS.length) {
        setIndex(raw);
        return;
      }
      if (index > 0) {
        try {
          window.history.pushState({ [STORY_HISTORY_KEY]: index }, "");
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [index]);

  const canAdvance = (() => {
    if (step.question === "role") return Boolean(session.role);
    if (step.question === "research") return session.researchKinds.length > 0;
    if (step.question === "audience") return Boolean(session.audience);
    if (step.question === "channel") return session.channelName.trim().length > 0;
    return true;
  })();

  const goTo = useCallback((nextIndex: number, mode: "push" | "replace") => {
    const clamped = Math.min(STEPS.length - 1, Math.max(0, nextIndex));
    setIndex(clamped);
    try {
      const state = { [STORY_HISTORY_KEY]: clamped };
      if (mode === "push") window.history.pushState(state, "");
      else window.history.replaceState({ ...window.history.state, ...state }, "");
    } catch {
      /* ignore */
    }
  }, []);

  const next = useCallback(() => {
    if (isFinish) return;
    if (isQuestion && !canAdvance) return;
    goTo(index + 1, "push");
  }, [canAdvance, goTo, index, isFinish, isQuestion]);

  const back = useCallback(() => {
    if (index <= 0) return;
    try {
      window.history.back();
    } catch {
      goTo(index - 1, "replace");
    }
  }, [goTo, index]);

  useEffect(() => {
    if (paused || reduced || isQuestion || isFinish || isDemo) return;
    const id = window.setTimeout(next, SEGMENT_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduced, isQuestion, isFinish, isDemo, next]);

  const onSubmitDemo = async (e: FormEvent) => {
    e.preventDefault();
    if (demoBusy) return;
    const value = demoEmail.trim();
    if (!isValidDemoEmail(value)) {
      setDemoError(DEMO_EMAIL_ERROR);
      return;
    }
    setDemoBusy(true);
    setDemoError("");
    try {
      await submitDemoRequest(value);
      setDemoSent(true);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : DEMO_EMAIL_ERROR);
    } finally {
      setDemoBusy(false);
    }
  };

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

  const finish = async (destination: "upload" | "demo" | "home" | "setup" | "signup") => {
    if (busy) return;
    setBusy(true);
    try {
      if (preview) markGuestStoryComplete();
      if (!preview && user) {
        await markStoryOnboardingComplete();
      }
      onFinished?.(destination === "signup" ? "setup" : destination);
      if (onFinished) return;
      if (preview) {
        if (destination === "demo") {
          navigate("/demo", { replace: true });
          return;
        }
        navigate("/signin?returnTo=/welcome%3Fsetup%3D1", { replace: true });
        return;
      }
      const needsTeam = !workspaces || workspaces.length === 0;
      if (needsTeam && (nativeViewerMode || isNativePlatform())) {
        navigate("/join", { replace: true });
        return;
      }
      if (destination === "setup" || destination === "signup" || needsTeam) {
        navigate("/welcome?setup=1", { replace: true });
        return;
      }
      if (destination === "upload") navigate("/studies/new", { replace: true });
      else if (destination === "demo") navigate("/demo", { replace: true });
      else navigate(appHomePath(), { replace: true });
    } catch (err) {
      console.error("[story-onboarding] complete failed", err);
      navigate(preview ? "/signin" : appHomePath(), { replace: true });
    } finally {
      setBusy(false);
    }
  };

  /** Skip the early story beats → jump to the demo capture step (artboard scene 4). */
  const skip = () => {
    if (busy || index >= DEMO_STEP_INDEX) return;
    goTo(DEMO_STEP_INDEX, "push");
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
      case "demo":
        return <DemoWhatYouGetCard />;
      case "preview":
        return <ChannelPreviewCard session={session} status="setting" />;
      case "ready":
        return <ChannelPreviewCard session={session} status="air" showNext />;
      default:
        return null;
    }
  })();

  const pillDot =
    step.scene === 0
      ? "purple"
      : step.scene === 1
        ? "pink"
        : step.scene === 2
          ? "amber"
          : step.scene === 3
            ? "green"
            : step.scene === 4
              ? "cyan"
              : step.scene === 6
                ? "green"
                : "purple";

  return (
    <SlopShell className="h-dvh" contentClassName="min-h-0">
      <div
        className="flex min-h-0 flex-1 flex-col"
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
        <div className="relative z-20 flex gap-1.5 px-6 pt-3.5" aria-hidden>
          {Array.from({ length: PROGRESS_COUNT }, (_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-sm"
              style={{
                background: i <= step.scene ? "#c084fc" : "rgba(255,255,255,0.12)",
                transition: reduced ? undefined : "background .4s ease",
              }}
            />
          ))}
        </div>

        <header className="slop-navbar relative z-20 shrink-0">
          <div className="slop-navbar-inner" style={{ flexWrap: "wrap", padding: "8px 24px" }}>
            <SlopBrand />
            <div className="slop-row">
              {(preview || replay) && (
                <span className="slop-status">
                  <span className="slop-dot slop-dot-green" />
                  Preview mode
                </span>
              )}
              {showSkip && (
                <button type="button" className="slop-btn slop-btn-ghost min-h-11" onClick={skip}>
                  Skip the story
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <main
            className={cn(
              "mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-6 py-6 lg:flex-row lg:gap-16",
              scrollableStep ? "lg:items-start" : "min-h-full items-center lg:items-center",
              showPricing ? "pb-4" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            )}
          >
            <div className={cn("rf-rise flex w-full flex-col items-start gap-5", "lg:max-w-[520px] lg:flex-1")}>
              <SlopPill dot={pillDot as "purple"}>{step.eyebrow}</SlopPill>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="slop-h1 m-0 text-balance outline-none"
                style={{ fontSize: "clamp(32px, 5.2vw, 68px)" }}
              >
                <Title text={step.title} />
              </h1>

              {isDemo && !demoSent && (
                <>
                  <p className="slop-lead m-0 max-w-[44ch]">{step.body}</p>
                  <form
                    noValidate
                    onSubmit={(e) => void onSubmitDemo(e)}
                    className="mt-1 flex w-full max-w-md flex-col gap-2"
                  >
                    <label htmlFor="rf-demo-email" className="text-[15px] font-semibold">
                      Work email
                    </label>
                    <div className="slop-ai-bar" style={{ minHeight: 56 }}>
                      <span aria-hidden>✨</span>
                      <input
                        id="rf-demo-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={demoEmail}
                        onChange={(e) => {
                          setDemoEmail(e.target.value);
                          setDemoError("");
                        }}
                        aria-describedby="rf-demo-error"
                        style={{ height: 44, fontSize: 18 }}
                      />
                      <button type="submit" className="slop-btn slop-btn-primary" style={{ minHeight: 44 }} disabled={demoBusy}>
                        {demoBusy ? "Sending…" : "Set up my demo 🚀"}
                      </button>
                    </div>
                    <span
                      id="rf-demo-error"
                      role="alert"
                      className="min-h-5 text-[14px] font-semibold"
                      style={{ color: "#fca5a5" }}
                    >
                      {demoError}
                    </span>
                  </form>
                </>
              )}

              {isDemo && demoSent && (
                <>
                  <div className="slop-alert slop-border-l-emerald w-full max-w-md" role="status">
                    <span className="slop-dot slop-dot-green" style={{ marginTop: 7 }} />
                    <div>Thanks — we’ll email {demoEmail.trim()} to set up your demo.</div>
                  </div>
                  <p className="slop-lead m-0 max-w-[44ch]">
                    No need to wait around — you can build your channel now and it will be ready when we talk.
                  </p>
                </>
              )}

              {!isDemo && <p className="slop-lead m-0 max-w-[44ch]">{step.body}</p>}

              {step.question === "role" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {STORY_ROLES.map((role) => (
                    <Chip
                      key={role}
                      selected={session.role === role}
                      onClick={() => setSession((s) => ({ ...s, role: role as StoryRole }))}
                    >
                      {ROLE_LABELS[role]}
                    </Chip>
                  ))}
                </div>
              )}

              {step.question === "research" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {STORY_RESEARCH_KINDS.map((kind) => {
                    const on = session.researchKinds.includes(kind);
                    return (
                      <Chip
                        key={kind}
                        selected={on}
                        onClick={() =>
                          setSession((s) => ({
                            ...s,
                            researchKinds: on
                              ? s.researchKinds.filter((k) => k !== kind)
                              : [...s.researchKinds, kind as StoryResearchKind],
                          }))
                        }
                      >
                        {kind}
                      </Chip>
                    );
                  })}
                </div>
              )}

              {step.question === "audience" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {STORY_AUDIENCES.map((aud) => (
                    <Chip
                      key={aud}
                      selected={session.audience === aud}
                      onClick={() => setSession((s) => ({ ...s, audience: aud as StoryAudience }))}
                    >
                      {aud}
                    </Chip>
                  ))}
                </div>
              )}

              {step.question === "channel" && (
                <div className="mt-2 w-full max-w-md">
                  <label className="slop-ai-bar block">
                    <span className="sr-only">Channel name</span>
                    <input
                      value={session.channelName}
                      onChange={(e) => setSession((s) => ({ ...s, channelName: e.target.value.slice(0, 60) }))}
                      placeholder="Team research"
                      className="w-full bg-transparent text-base font-semibold outline-none"
                    />
                  </label>
                  <p className="slop-muted mt-2 text-sm">Suggestion from your email. Edit freely.</p>
                </div>
              )}

              <div className="slop-row mt-2 flex-wrap gap-2">
                {index > 0 && !(isDemo && demoSent) && (
                  <button type="button" className="slop-btn slop-btn-ghost slop-btn-lg" onClick={back}>
                    Back
                  </button>
                )}
                {isDemo && demoSent && (
                  <>
                    <button
                      type="button"
                      className="slop-btn slop-btn-ghost slop-btn-lg"
                      onClick={() => {
                        setDemoSent(false);
                        setDemoError("");
                      }}
                    >
                      Change email
                    </button>
                    <button type="button" className="slop-btn slop-btn-primary slop-btn-lg" onClick={next}>
                      Build my channel
                    </button>
                  </>
                )}
                {isFinish ? (
                  <>
                    {preview ? (
                      <button
                        type="button"
                        className="slop-btn slop-btn-primary slop-btn-lg"
                        disabled={busy}
                        onClick={() => void finish("signup")}
                      >
                        Sign in to upload 🚀
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="slop-btn slop-btn-primary slop-btn-lg"
                        disabled={busy}
                        onClick={() =>
                          void finish(workspaces && workspaces.length > 0 ? "upload" : "setup")
                        }
                      >
                        {workspaces && workspaces.length > 0 ? "Upload research" : "Set up workspace"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="slop-btn slop-btn-rainbow slop-btn-lg"
                      disabled={busy}
                      onClick={() => void finish("demo")}
                    >
                      Watch the demo
                    </button>
                  </>
                ) : !isDemo ? (
                  <button
                    type="button"
                    className="slop-btn slop-btn-primary slop-btn-lg"
                    disabled={!canAdvance}
                    onClick={next}
                  >
                    {step.cta ?? "Continue"}
                  </button>
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                "relative flex w-full items-center justify-center",
                scrollableStep ? "shrink-0 lg:max-w-[58%] lg:flex-1" : "min-h-[280px] flex-1",
              )}
            >
              {!isQuestion &&
                !isFinish &&
                !isDemo &&
                step.visual !== "crt" &&
                step.visual !== "yellow" &&
                step.visual !== "scattered" &&
                step.visual !== "phone" && (
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
              <div className="rf-rise relative z-0 w-full">{visual}</div>
            </div>
          </main>

          {showPricing && (
            <div className="mx-auto w-full max-w-[1200px] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <StorySignupPlans
                onStartFree={() => void finish("signup")}
                onStartPaid={() => void finish("signup")}
              />
            </div>
          )}

          {(preview || replay) && (
            <p className="slop-muted relative z-20 px-6 pb-4 text-xs">
              {preview
                ? "Preview mode — answers aren't saved until you sign in."
                : "Replaying the product story. Finish to mark it complete."}
            </p>
          )}
        </div>
      </div>
    </SlopShell>
  );
}
