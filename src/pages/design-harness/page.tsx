import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { JoinCodePanelView } from "@/components/design-system/join-code-panel.tsx";
import { StudyShell } from "@/components/design-system/study-shell.tsx";
import SlopShell, { SlopBrand, SlopPill } from "@/components/slop/slop-shell.tsx";
import ViewerOnboarding from "@/components/viewer-onboarding/viewer-onboarding.tsx";
import StorySignupPlans from "@/components/story-onboarding/story-signup-plans.tsx";
import {
  DIVISION_CHANNEL_CODES,
  DIVISION_HINTS,
  DIVISION_LABELS,
  DIVISION_SLUGS,
  divisionFeedPath,
  type DivisionSlug,
} from "@/lib/divisions.ts";
import { cn } from "@/lib/utils.ts";

/** Fixture for the web story finish step with pricing (desktop + mobile web). */
function StorySignupFixture() {
  return (
    <SlopShell>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <SlopBrand />
        <SlopPill dot="green">You&apos;re on air</SlopPill>
        <h1 className="slop-h1 mt-4 text-balance" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          Pick a plan and start your{" "}
          <span className="slop-serif-emphasis slop-text-gradient-hot">channel</span>.
        </h1>
        <p className="slop-lead mt-2 max-w-prose">
          Same prices as the site. Viewers stay free. Paid plans open Stripe after workspace setup.
        </p>
        <div className="mt-8">
          <StorySignupPlans onStartFree={() => undefined} onStartPaid={() => undefined} />
        </div>
      </div>
    </SlopShell>
  );
}

const FIXTURE_CODE = "7K3M9PQ2";
const WORKSPACE = "Acme Research";

const HARNESS_SCREENS = [
  "01-viewer-onboarding",
  "02-story-signup",
  "07-join-code",
  "08-division",
  "10-upload",
  "11-processing",
  "12-editor",
  "join",
  "home",
  "feed",
  "settings",
] as const;

type HarnessScreen = (typeof HARNESS_SCREENS)[number];

function isHarnessScreen(value: string | undefined): value is HarnessScreen {
  return !!value && (HARNESS_SCREENS as readonly string[]).includes(value);
}

function DesktopChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(15 23 42 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgb(15 23 42 / 0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">{WORKSPACE}</span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">Owner</span>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-2">{children}</main>
    </div>
  );
}

function DivisionPickerFixture() {
  const [current, setCurrent] = useState<DivisionSlug | null>("auto");
  return (
    <StudyShell step="publish">
      <section className="space-y-8">
        <div className="flex flex-col items-start gap-4">
          <SlopPill dot="cyan">Review &amp; publish</SlopPill>
          <h3 className="slop-h1 m-0 text-balance" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}>
            Which <span className="slop-serif-emphasis slop-text-gradient-hot">channel</span> gets{" "}
            <span className="slop-underline slop-underline-cyan">this</span> study?
          </h3>
          <p className="slop-lead m-0 max-w-[52ch]">
            Assign it to a phone division feed — before or after publishing.
          </p>
        </div>
        <div className="flex flex-wrap items-stretch gap-6">
          <div className="slop-card flex min-w-0 flex-[999_1_520px] flex-col gap-5 p-8">
            <p className="m-0 font-mono text-[13px] tracking-[0.12em] uppercase" style={{ color: "#94a3b8" }}>
              Phone division feed
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DIVISION_SLUGS.map((slug) => {
                const selected = current === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={selected}
                    title={DIVISION_HINTS[slug]}
                    onClick={() => setCurrent(slug)}
                    className={cn(
                      "min-h-[4.5rem] cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-violet-400/60 bg-violet-500/20 text-white"
                        : "border-white/15 bg-white/5 text-slate-200 hover:border-white/30",
                    )}
                  >
                    <span className="font-mono text-[11px] tracking-[0.12em]" style={{ color: selected ? "#c084fc" : "#94a3b8" }}>
                      {DIVISION_CHANNEL_CODES[slug]}
                    </span>
                    <span className="mt-1 block text-lg font-bold">{DIVISION_LABELS[slug]}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-pressed={current === null}
              onClick={() => setCurrent(null)}
              className={cn(
                "flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed px-4 text-sm font-medium",
                current === null
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/20 text-slate-400 hover:border-white/40",
              )}
            >
              None. Keep this study off phone division feeds
            </button>
          </div>
          <aside className="slop-card slop-border-l-cyan flex min-w-0 flex-1 flex-col gap-3 p-7" style={{ flexBasis: 280 }}>
            <p className="m-0 font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#94a3b8" }}>
              Where it lands
            </p>
            {current ? (
              <>
                <p className="m-0 text-2xl font-bold" style={{ color: "#c084fc" }}>
                  {DIVISION_LABELS[current]} channel
                </p>
                <p className="m-0 text-sm" style={{ color: "#94a3b8" }}>
                  Scenes from this study appear in the {DIVISION_LABELS[current]} channel on the iOS app.
                </p>
                <span className="slop-badge slop-badge-ai mt-4 w-fit">iOS app</span>
              </>
            ) : (
              <>
                <p className="m-0 text-2xl font-bold text-white/80">Off phone feeds</p>
                <p className="m-0 text-sm" style={{ color: "#94a3b8" }}>
                  This study stays on the desktop workspace until you assign a division channel.
                </p>
              </>
            )}
          </aside>
        </div>
      </section>
    </StudyShell>
  );
}

function UploadFixture() {
  return (
    <StudyShell step="upload">
      <div className="rf-rise grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <SlopPill dot="purple">Team research · First study</SlopPill>
          <h1 className="slop-h1 m-0 text-balance" style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}>
            Empty <span className="slop-underline slop-underline-squiggle slop-underline-pink">the</span>{" "}
            <span className="slop-serif-emphasis slop-text-gradient-hot">drawer</span>.
          </h1>
          <p className="slop-lead m-0 max-w-[44ch]">
            Drop in the interviews, surveys and decks from one study. Messy is fine — we&apos;ll cut them into short
            insight scenes.
          </p>
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="harness-study-name" className="text-[15px] font-semibold">
              Study name
            </label>
            <div className="slop-ai-bar" style={{ minHeight: 56 }}>
              <span aria-hidden>✨</span>
              <input
                id="harness-study-name"
                placeholder="e.g. Q3 onboarding interviews"
                style={{ height: 44, fontSize: 18 }}
                defaultValue=""
              />
            </div>
          </div>
          <button type="button" className="slop-btn slop-btn-ghost slop-btn-lg">
            No files handy? Use the sample study
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div
            className="slop-card flex min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center"
            style={{ border: "2px dashed rgba(192,132,252,.5)" }}
          >
            <span className="slop-icon-box slop-icon-cyan mb-0" aria-hidden>
              📂
            </span>
            <div className="slop-text-gradient text-[1.75rem] font-extrabold tracking-tight">
              Drop research files here
            </div>
            <button type="button" className="slop-btn slop-btn-primary">
              Choose files
            </button>
            <span className="font-mono text-[13px]" style={{ color: "#94a3b8" }}>
              docx · xlsx · pdf · md · pptx
            </span>
          </div>
          <p className="m-0 text-[15px]" style={{ color: "#94a3b8" }}>
            Nothing here yet.
          </p>
        </div>
      </div>
    </StudyShell>
  );
}

function ProcessingFixture() {
  const phases = [
    "Reading your files",
    "Finding the moments that matter",
    "Writing short insight scenes",
    "Lining up the feed",
  ];
  return (
    <StudyShell step="scenes">
      <div className="rf-rise grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <SlopPill dot="pink">In the edit room</SlopPill>
          <h1
            className="slop-h1 slop-text-gradient m-0 text-balance"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
          >
            That&apos;s a cut.
          </h1>
          <p className="slop-lead m-0 max-w-[44ch]">
            We&apos;re reading every file so your team doesn&apos;t have to. You can leave this tab — nothing goes on
            air until you&apos;ve reviewed it.
          </p>
          <button type="button" className="slop-btn slop-btn-primary slop-btn-lg">
            Review the scenes
          </button>
        </div>
        <aside className="flex min-h-[280px] items-center justify-center">
          <div className="slop-card slop-card-beam flex w-full max-w-[440px] flex-col gap-6 p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="slop-row">
                <span className="slop-icon-box slop-icon-pink mb-0" aria-hidden>
                  ✂️
                </span>
                <span className="font-mono text-[13px] tracking-[0.12em] uppercase" style={{ color: "#94a3b8" }}>
                  Sample study
                </span>
              </span>
              <span className="slop-status">
                <span className="slop-dot slop-dot-green" />
                Ready for review
              </span>
            </div>
            <div className="slop-progress" aria-hidden>
              <div className="slop-progress-bar" style={{ width: "100%" }} />
            </div>
            <ol className="m-0 flex list-none flex-col gap-[18px] p-0">
              {phases.map((label) => (
                <li key={label} className="flex items-center gap-3.5" style={{ color: "#f8fafc" }}>
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981" }}
                  />
                  <span className="flex-1 text-lg font-semibold">{label}</span>
                  <span className="font-mono text-[13px]">Done</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </StudyShell>
  );
}

const DEMO_SCENES = [
  {
    n: 1,
    quote: "It stopped feeling like help and started feeling like homework.",
    meta: "Parent of two • 7 months",
    source: "interviews.docx",
  },
  {
    n: 2,
    quote: "[DEMO SCENE: a second quote from the interviews]",
    meta: "[PARTICIPANT]",
    source: "interviews.docx",
  },
  {
    n: 3,
    quote: "[DEMO SCENE: a finding from the survey]",
    meta: "[SEGMENT]",
    source: "survey-q3.xlsx",
  },
  {
    n: 4,
    quote: "[DEMO SCENE: a moment from the usability test]",
    meta: "[PARTICIPANT]",
    source: "usability.pdf",
  },
];

function EditorFixture() {
  const [kept, setKept] = useState(() => DEMO_SCENES.map(() => true));
  const keptCount = kept.filter(Boolean).length;
  return (
    <StudyShell step="scenes">
      <div className="rf-rise flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start gap-4">
          <SlopPill dot="purple">Sample study · First cut</SlopPill>
          <h1 className="slop-h1 m-0 text-balance" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
            You&apos;re <span className="slop-underline slop-underline-emerald">the</span>{" "}
            <span className="slop-serif-emphasis slop-text-gradient-hot">editor</span>.
          </h1>
          <p className="slop-lead m-0 max-w-[52ch]">
            Keep the scenes worth your team&apos;s scroll — cut the rest. Nothing airs without your say.
          </p>
        </div>
        <div className="slop-row flex-wrap">
          <span className="slop-status" aria-live="polite">
            <span className="slop-dot slop-dot-green" />
            {keptCount} of {DEMO_SCENES.length} scenes kept
          </span>
          <button type="button" className="slop-btn slop-btn-primary slop-btn-lg">
            Pick a channel
          </button>
        </div>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_SCENES.map((scene, i) => (
          <li key={scene.n} className="slop-card flex flex-col gap-3 p-5">
            <p className="m-0 font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#94a3b8" }}>
              Scene {scene.n}
            </p>
            <p className="m-0 flex-1 font-[family-name:var(--font-serif)] text-[1.05rem] leading-snug italic text-white">
              “{scene.quote}”
            </p>
            <p className="m-0 text-xs" style={{ color: "#94a3b8" }}>
              {scene.meta}
            </p>
            <span
              className="w-fit rounded-full px-2.5 py-1 font-mono text-[10px]"
              style={{ background: "rgba(255,255,255,.08)", color: "#cbd5e1" }}
            >
              Cut from {scene.source}
            </span>
            <button
              type="button"
              aria-pressed={kept[i]}
              onClick={() => setKept((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              className={cn(
                "mt-1 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold",
                kept[i] ? "bg-amber-300 text-black" : "bg-white/10 text-white/70",
              )}
            >
              {kept[i] ? "Keeping. Tap to cut" : "Cut. Tap to keep"}
            </button>
          </li>
        ))}
      </ul>
    </StudyShell>
  );
}

function JoinFixture() {
  const chars = FIXTURE_CODE.split("");
  return (
    <SlopShell>
      <header className="slop-navbar relative z-20">
        <div className="slop-navbar-inner px-6 py-2">
          <SlopBrand />
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-6 pb-12 pt-10">
        <div className="rf-rise flex flex-col items-start gap-4">
          <SlopPill dot="cyan">Join the channel</SlopPill>
          <h1 className="slop-h1 m-0 text-balance" style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)" }}>
            Enter the team <span className="slop-serif-emphasis slop-text-gradient-hot">join code</span>
          </h1>
          <p className="slop-lead m-0 max-w-[44ch]">
            Ask your researcher for the code from Workspace settings. You&apos;ll land straight in their feed.
          </p>
          <div className="slop-card mt-4 w-full p-6">
            <p className="m-0 font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#94a3b8" }}>
              Team join code
            </p>
            <div className="mt-5 grid grid-cols-8 gap-1.5 sm:gap-2">
              {chars.map((ch, i) => (
                <span
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-xl border font-mono text-lg font-bold sm:text-xl"
                  style={{
                    borderColor: "rgba(192,132,252,.35)",
                    background: "rgba(2,6,23,.7)",
                    color: "#c084fc",
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
            <button type="button" className="slop-btn slop-btn-primary slop-btn-lg mt-6 w-full">
              Connect
            </button>
          </div>
          <aside className="slop-card slop-border-l-cyan mt-2 w-full p-5">
            <p className="m-0 font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "#94a3b8" }}>
              How viewers join
            </p>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-200">
              {["Open the iOS app, or go to /join on the web", "Enter the code", "Start scrolling Acme Research"].map(
                (line, i) => (
                  <li key={line} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #4338ca, #7e22ce)" }}
                    >
                      {i + 1}
                    </span>
                    {line}
                  </li>
                ),
              )}
            </ol>
          </aside>
        </div>
      </main>
    </SlopShell>
  );
}

function HomeFixture() {
  return (
    <div className="dark flex h-dvh flex-col bg-studio text-white">
      <header className="flex items-center gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo className="text-white" />
        <span className="ml-auto rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">Viewer</span>
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-eyebrow uppercase">Channels</p>
        <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-white">Pick a division</h1>
        <p className="mt-2 max-w-xs text-center text-sm text-white/55">
          Each feed is curated separately by your research team.
        </p>
        <ul className="mt-10 flex w-full max-w-sm flex-col gap-2.5">
          {DIVISION_SLUGS.map((slug) => (
            <li key={slug}>
              <Link
                to={divisionFeedPath(slug)}
                className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.05] px-5 text-left"
              >
                <span className="flex flex-col">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-mark">{DIVISION_CHANNEL_CODES[slug]}</span>
                  <span className="text-base font-semibold tracking-wide text-white">{DIVISION_LABELS[slug]}</span>
                </span>
                <span className="text-xs font-medium text-white/45">{DIVISION_HINTS[slug]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function FeedFixture() {
  return (
    <div className="dark relative flex h-dvh flex-col overflow-hidden bg-studio text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex h-11 items-center gap-2 px-2 font-mono text-[11px] tracking-[0.12em] uppercase">
          <span aria-hidden>←</span> Auto
        </div>
        <span className="pointer-events-auto rounded-xl bg-mark px-3 py-2 text-[11px] font-semibold text-mark-foreground">
          Add to PPT
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col justify-end px-5 pb-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(37_99_235_/_0.22),transparent_55%)]" aria-hidden />
        <div className="relative max-w-[22rem]">
          <p className="font-mono text-[10px] tracking-[0.14em] text-eyebrow uppercase">CH 01 · Auto</p>
          <p className="quote-voice mt-4 text-[1.65rem] leading-[1.15]">
            “It stopped feeling like help and started feeling like homework.”
          </p>
          <p className="mt-3 text-xs text-white/55">Parent of two • 7 months</p>
          <span className="mt-4 inline-flex rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/80">
            Cut from interviews.docx
          </span>
        </div>
        <div
          className="absolute right-4 bottom-28 flex flex-col items-center gap-4"
          role="group"
          aria-label="Scene actions"
        >
          {[
            ["Like", false],
            ["Comment", false],
            ["Heard this before", true],
          ].map(([label, on]) => (
            <div key={label as string} className="flex flex-col items-center gap-1 text-white">
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-full text-[10px] font-semibold",
                  on ? "bg-white text-black" : "bg-black/50",
                )}
              >
                {(label as string).slice(0, 1)}
              </span>
              <span className="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight">{label as string}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-1 w-full bg-white/15">
        <div className="h-full w-2/5 bg-mark" />
      </div>
    </div>
  );
}

function SettingsFixture() {
  return (
    <DesktopChrome>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{WORKSPACE}</h1>
          <p className="mt-2 text-sm text-muted-foreground">You're an owner of this workspace.</p>
        </div>
        <JoinCodePanelView
          workspaceName={WORKSPACE}
          code={FIXTURE_CODE}
          hideEmail
          onCopy={() => undefined}
          onRegenerate={() => undefined}
        />
        <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-lift">
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Invites</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Invite people</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone with the link can join until it expires or runs out of uses.
          </p>
          <Button className="mt-4 h-11 font-semibold">Create link</Button>
        </section>
      </div>
    </DesktopChrome>
  );
}

/**
 * DEV-only Storybook-style harness for design screens that normally need auth.
 * Visit `/__design/07-join-code` etc. No live DB writes.
 */
export default function DesignHarnessPage() {
  const { screen } = useParams();
  const enabled = import.meta.env.DEV || import.meta.env.VITE_DESIGN_HARNESS === "true";

  const index = useMemo(
    () => (
      <div className="mx-auto max-w-lg space-y-4 px-6 py-16">
        <Logo />
        <h1 className="text-2xl font-bold">Design harness</h1>
        <p className="text-sm text-muted-foreground">Fixture screens for Isaac’s design PDF — no auth, no DB writes.</p>
        <ul className="space-y-2">
          {HARNESS_SCREENS.map((id) => (
            <li key={id}>
              <Link className="font-medium text-primary underline-offset-2 hover:underline" to={`/__design/${id}`}>
                {id}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ),
    [],
  );

  if (!enabled) return <Navigate to="/" replace />;
  if (!screen) return index;
  if (!isHarnessScreen(screen)) return <Navigate to="/__design" replace />;

  switch (screen) {
    case "01-viewer-onboarding":
      return <ViewerOnboarding />;
    case "02-story-signup":
      return <StorySignupFixture />;
    case "07-join-code":
      return (
        <SlopShell>
          <header className="slop-navbar relative z-20">
            <div className="slop-navbar-inner flex-wrap px-6 py-2">
              <SlopBrand />
              <div className="slop-row">
                <span className="slop-status">
                  <span className="slop-dot slop-dot-green" />
                  Signed in
                </span>
                <span className="text-[15px] font-semibold">{WORKSPACE}</span>
                <span className="slop-badge slop-badge-ai">Owner</span>
              </div>
            </div>
          </header>
          <main className="relative z-10 mx-auto w-full max-w-[1120px] flex-1 px-6 py-10 lg:px-16">
            <JoinCodePanelView
              workspaceName={WORKSPACE}
              code={FIXTURE_CODE}
              hideEmail
              onCopy={() => undefined}
              onRegenerate={() => undefined}
            />
          </main>
        </SlopShell>
      );
    case "08-division":
      return <DivisionPickerFixture />;
    case "10-upload":
      return <UploadFixture />;
    case "11-processing":
      return <ProcessingFixture />;
    case "12-editor":
      return <EditorFixture />;
    case "join":
      return <JoinFixture />;
    case "home":
      return <HomeFixture />;
    case "feed":
      return <FeedFixture />;
    case "settings":
      return <SettingsFixture />;
    default:
      return index;
  }
}
