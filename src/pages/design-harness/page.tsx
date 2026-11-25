import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Upload } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { JoinCodePanelView } from "@/components/design-system/join-code-panel.tsx";
import { StudyShell } from "@/components/design-system/study-shell.tsx";
import {
  DIVISION_CHANNEL_CODES,
  DIVISION_HINTS,
  DIVISION_LABELS,
  DIVISION_SLUGS,
  divisionFeedPath,
  type DivisionSlug,
} from "@/lib/divisions.ts";
import { cn } from "@/lib/utils.ts";

const FIXTURE_CODE = "7K3M9PQ2";
const WORKSPACE = "Acme Research";

const HARNESS_SCREENS = [
  "07-join-code",
  "08-division",
  "10-upload",
  "11-processing",
  "12-editor",
  "join",
  "home",
  "feed",
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
    <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-lift">
        <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Review & publish</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Which channel gets this study?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Assign it to a phone division feed. You can do this before or after publishing.
        </p>
        <div className="mt-6">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Phone division feed</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    selected ? "border-studio bg-studio text-white" : "border-border bg-background hover:border-foreground/30",
                  )}
                >
                  <span className={cn("font-mono text-[11px] tracking-[0.12em]", selected ? "text-mark" : "text-muted-foreground")}>
                    {DIVISION_CHANNEL_CODES[slug]}
                  </span>
                  <span className={cn("mt-1 block text-lg font-bold", selected ? "text-white" : "text-foreground")}>
                    {DIVISION_LABELS[slug]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={current === null}
            onClick={() => setCurrent(null)}
            className={cn(
              "mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed px-4 text-sm font-medium",
              current === null
                ? "border-foreground bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40",
            )}
          >
            None. Keep this study off phone division feeds
          </button>
        </div>
      </div>
      <aside className="rounded-[1.5rem] bg-studio p-6 text-white shadow-lift">
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Where it lands</p>
        {current ? (
          <>
            <p className="mt-3 text-2xl font-bold text-mark">{DIVISION_LABELS[current]} channel</p>
            <p className="mt-2 text-sm text-white/70">
              Scenes from this study appear in the {DIVISION_LABELS[current]} channel on the iOS app.
            </p>
            <span className="mt-6 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              iOS app
            </span>
          </>
        ) : (
          <>
            <p className="mt-3 text-2xl font-bold text-white/80">Off phone feeds</p>
            <p className="mt-2 text-sm text-white/60">
              This study stays on the desktop workspace until you assign a division channel.
            </p>
          </>
        )}
      </aside>
    </section>
  );
}

function UploadFixture() {
  return (
    <StudyShell step="upload">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Team research · first study</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Empty the drawer.</h1>
          <p className="mt-3 max-w-prose text-muted-foreground">
            Drop in the interviews, surveys and decks from one study. Messy is fine. We’ll cut them into short insight scenes.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="harness-study-name" className="font-semibold">
              Study name
            </Label>
            <Input id="harness-study-name" className="h-11" placeholder="e.g. Q3 onboarding interviews" defaultValue="" />
          </div>
          <Button type="button" variant="outline" className="mt-4 h-11 rounded-full font-semibold">
            No files handy? Use the sample study
          </Button>
        </div>
        <div className="rounded-[1.5rem] border border-dashed border-border bg-card p-8 shadow-lift">
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Upload className="size-8 text-primary" />
            <p className="mt-3 text-base font-bold">Drop research files here</p>
            <span className="mt-4 inline-flex h-10 items-center rounded-full bg-studio px-5 text-sm font-semibold text-white">
              Choose files
            </span>
            <p className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground">docx · xlsx · pdf · md · pptx</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Nothing here yet.</p>
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
      <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">In the edit room</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">That's a cut.</h1>
          <p className="mt-3 max-w-prose text-muted-foreground">
            We’re reading every file so your team doesn’t have to. You can leave this tab. Nothing goes on air until you’ve reviewed it.
          </p>
          <Button className="mt-6 h-11 font-semibold">Review the scenes</Button>
        </div>
        <aside className="rounded-[1.5rem] bg-studio p-6 text-white shadow-lift">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Sample study</p>
            <span className="rounded-full bg-mark px-2.5 py-0.5 text-[11px] font-semibold text-mark-foreground">
              Ready for review
            </span>
          </div>
          <div className="mt-3 h-0.5 rounded-full bg-mark" />
          <ul className="mt-5 space-y-3">
            {phases.map((label) => (
              <li key={label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-mark" />
                  {label}
                </span>
                <span className="text-white/55">Done</span>
              </li>
            ))}
          </ul>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Sample study · first cut</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">You're the editor.</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Keep the scenes worth your team's scroll. Cut the rest. Nothing airs without your say.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {keptCount} of {DEMO_SCENES.length} scenes kept
          </span>
          <Button className="h-11 font-semibold">Pick a channel</Button>
        </div>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_SCENES.map((scene, i) => (
          <li key={scene.n} className="flex flex-col rounded-[1.5rem] bg-studio p-4 text-white shadow-lift">
            <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Scene {scene.n}</p>
            <p className="mt-3 flex-1 font-serif text-[1.05rem] leading-snug">“{scene.quote}”</p>
            <p className="mt-3 text-xs text-white/50">{scene.meta}</p>
            <span className="mt-3 w-fit rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/80">
              Cut from {scene.source}
            </span>
            <button
              type="button"
              aria-pressed={kept[i]}
              onClick={() => setKept((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              className={cn(
                "mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold",
                kept[i] ? "bg-mark text-mark-foreground" : "bg-white/10 text-white/70",
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
    <div className="dark flex min-h-dvh flex-col bg-studio px-5 py-10 text-white">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
        <Logo className="text-white" />
      </header>
      <main className="mx-auto mt-12 w-full max-w-lg flex-1">
        <p className="font-mono text-[11px] tracking-[0.16em] text-eyebrow uppercase">Join the channel</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Enter the team join code</h1>
        <p className="mt-2 text-sm text-white/60">
          Ask your researcher for the code from Workspace settings. You’ll land straight in their feed.
        </p>
        <div className="mt-8 rounded-[1.5rem] bg-[#12162a] p-5 sm:p-6">
          <p className="font-mono text-[10px] tracking-[0.14em] text-eyebrow uppercase">Team join code</p>
          <div className="mt-5 grid grid-cols-8 gap-1.5 sm:gap-2">
            {chars.map((ch, i) => (
              <span
                key={i}
                className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-[#0a0d16] font-mono text-lg font-bold text-mark sm:text-xl"
              >
                {ch}
              </span>
            ))}
          </div>
          <Button className="mt-6 h-11 w-full font-semibold">Connect</Button>
        </div>
        <aside className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">How viewers join</p>
          <ol className="mt-3 space-y-2.5 text-sm text-white/80">
            {["Open the iOS app, or go to /join on the web", "Enter the code", "Start scrolling Acme Research"].map(
              (line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-studio">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ),
            )}
          </ol>
        </aside>
      </main>
    </div>
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
    <div className="dark relative flex h-dvh flex-col overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex h-11 items-center gap-2 px-2 text-sm font-medium">
          <span aria-hidden>←</span> Auto
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[#0f172a] p-5 shadow-sheet">
          <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">CH 01 · Auto</p>
          <p className="mt-4 font-serif text-xl leading-snug">
            “It stopped feeling like help and started feeling like homework.”
          </p>
          <p className="mt-3 text-xs text-white/50">Parent of two • 7 months</p>
          <span className="mt-4 inline-flex rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/80">
            Cut from interviews.docx
          </span>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <span className="rounded-full bg-white/12 px-3 py-2 text-center text-[11px] font-medium">Add to PPT</span>
            <span className="rounded-full bg-white/12 px-3 py-2 text-center text-[11px] font-medium">Like</span>
            <span className="rounded-full bg-white/12 px-3 py-2 text-center text-[11px] font-medium">Comment</span>
            <span className="rounded-full bg-mark px-3 py-2 text-center text-[11px] font-semibold text-mark-foreground">
              Heard this before
            </span>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/40">Fixture feed · four actions · no live data</p>
      </div>
    </div>
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
    case "07-join-code":
      return (
        <DesktopChrome>
          <JoinCodePanelView workspaceName={WORKSPACE} code={FIXTURE_CODE} hideEmail onCopy={() => undefined} onRegenerate={() => undefined} />
        </DesktopChrome>
      );
    case "08-division":
      return (
        <DesktopChrome>
          <DivisionPickerFixture />
        </DesktopChrome>
      );
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
    default:
      return index;
  }
}
