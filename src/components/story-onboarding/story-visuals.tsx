import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils.ts";
import type { StorySession } from "@/lib/story-onboarding.ts";
import { ROLE_LABELS } from "@/lib/story-onboarding.ts";

type VisualProps = {
  reduced: boolean;
  className?: string;
  onActivate?: () => void;
};

const STORY_MEDIA = {
  apollo: { src: "/story/apollo.mp4", poster: "/story/apollo.jpg" },
  reels: [
    {
      quote: "“It stopped feeling like help and started feeling like homework.”",
      who: "Parent of two · 7 months",
      source: "interviews.docx",
      short: "“It stopped feeling like help…”",
      title: "Help became homework",
      src: "/story/reel-1.mp4",
      poster: "/story/reel-1.jpg",
    },
    {
      quote: "“I only open it when it nags me.”",
      who: "Demo quote · swap in your own",
      source: "interviews.docx",
      short: "“I only open it when it nags me.”",
      title: "Only when it nags",
      src: "/story/reel-2.mp4",
      poster: "/story/reel-2.jpg",
    },
    {
      quote: "“Week one felt like magic. By week three I’d muted it.”",
      who: "Demo quote · swap in your own",
      source: "usability.pdf",
      short: "“Week one felt like magic…”",
      title: "Muted by week three",
      src: "/story/reel-3.mp4",
      poster: "/story/reel-3.jpg",
    },
  ],
} as const;

function MutedLoopVideo({
  src,
  poster,
  reduced,
  label,
  className,
}: {
  src: string;
  poster: string;
  reduced: boolean;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.loop = true;
    if (reduced) {
      v.pause();
      return;
    }
    const play = () => {
      try {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      } catch {
        /* autoplay blocked */
      }
    };
    if (v.readyState >= 2) play();
    else v.addEventListener("canplay", play, { once: true });
    return () => v.removeEventListener("canplay", play);
  }, [reduced, src]);

  if (reduced) {
    return (
      <img
        src={poster}
        alt={label}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      playsInline
      loop
      preload="metadata"
      aria-label={label}
      className={cn("absolute inset-0 size-full object-cover pointer-events-none", className)}
    />
  );
}

/** Retro CRT — dark until tapped / Turn it on; then Apollo loop. */
export function CrtTvVisual({ reduced, className, onActivate }: VisualProps) {
  const [on, setOn] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (!on) {
          setOn(true);
          return;
        }
        onActivate?.();
      }}
      className={cn(
        "relative mx-auto flex h-full max-h-[440px] w-full max-w-md cursor-pointer items-center justify-center border-0 bg-transparent p-0",
        className,
      )}
      aria-label={on ? "Keep watching" : "Tap to turn it on"}
    >
      <div
        className={cn(
          "relative aspect-[5/4] w-[86%] overflow-hidden rounded-[1.4rem] border-[3px] border-[#1e2436] bg-[#0c101c]",
          !reduced && "story-crt-glow",
        )}
      >
        {on ? (
          <>
            <MutedLoopVideo
              src={STORY_MEDIA.apollo.src}
              poster={STORY_MEDIA.apollo.poster}
              reduced={reduced}
              label="Archive television footage of the Apollo 11 moonwalk, July 1969"
            />
            <div className="absolute inset-x-2.5 bottom-2.5 rounded-[10px] bg-[rgba(2,6,23,.78)] px-3 py-2 text-left text-white">
              <div className="text-[15px] font-bold">July 20, 1969 — the Moon landing</div>
              <div className="text-[13px] font-medium">One broadcast. The whole world watching.</div>
            </div>
          </>
        ) : (
          <div className="absolute inset-4 flex flex-col items-center justify-center gap-3 rounded-lg bg-[#080a12]">
            <span className="grid size-10 place-items-center rounded-full border border-white/25 text-white/80">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3v8" strokeLinecap="round" />
                <path d="M7.5 6.5a7 7 0 1 0 9 0" strokeLinecap="round" />
              </svg>
            </span>
            <p className="text-[11px] font-medium tracking-[0.12em] text-white/55 uppercase">
              Tap to turn it on
            </p>
          </div>
        )}
        <div className="absolute inset-x-8 bottom-5 grid grid-cols-10 gap-1.5">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="aspect-square rounded-full bg-[#1a2240]" />
          ))}
        </div>
      </div>
    </button>
  );
}

const SHATTER_LABELS = [
  "For you",
  "Continue watching",
  "Suggested",
  "Because you watched",
  "Up next",
  "Your mix",
  "Recommended",
  "Watch again",
  "New for you",
  "Top picks",
  "Trending for you",
  "Skip intro",
];
const HUES = ["#a855f7", "#ec4899", "#22d3ee", "#fbbf24", "#34d399", "#f472b6"];

/** Now scene: Apollo clip, then shatter into streaming tiles. */
export function YellowScreenVisual({ reduced, className, onActivate }: VisualProps) {
  const [shattered, setShattered] = useState(false);

  return (
    <div
      className={cn(
        "relative mx-auto flex h-full max-h-[480px] w-full max-w-lg flex-col items-center justify-center gap-8",
        className,
      )}
    >
      {!shattered ? (
        <button
          type="button"
          onClick={() => setShattered(true)}
          aria-label="Change the channel"
          className="w-full max-w-[440px] cursor-pointer rounded-[28px] border border-white/12 bg-[rgba(15,23,42,.9)] p-4 text-inherit shadow-[0_0_120px_rgba(168,85,247,.45)]"
        >
          <span className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-black text-white">
            <MutedLoopVideo
              src={STORY_MEDIA.apollo.src}
              poster={STORY_MEDIA.apollo.poster}
              reduced={reduced}
              label="Archive television footage of the Apollo 11 moonwalk, July 1969"
            />
            <span className="absolute inset-x-2.5 bottom-2.5 block rounded-[10px] bg-[rgba(2,6,23,.78)] px-3 py-2 text-center text-[14px] font-bold tracking-[0.1em] text-white uppercase">
              Tap to change the channel
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onActivate}
          aria-label="Continue"
          className="grid w-full max-w-[520px] cursor-pointer grid-cols-4 gap-3 border-0 bg-transparent p-0"
        >
          {SHATTER_LABELS.map((label, i) => {
            const hue = HUES[(i * 5) % 6]!;
            return (
              <div
                key={label}
                className={cn(
                  "flex aspect-[4/3] flex-col justify-between rounded-xl border border-white/10 border-l-4 bg-[rgba(15,23,42,.9)] p-2.5",
                  !reduced && "rf-pop",
                )}
                style={{
                  borderLeftColor: hue,
                  boxShadow: `0 0 18px ${hue}55`,
                  transform: `rotate(${[-3, 2, -1, 3, 1, -2, 2, -3, 3, -1, 1, -2][i]}deg)`,
                  animationDelay: reduced ? undefined : `${i * 40}ms`,
                }}
              >
                <span className="text-left text-[12px] font-semibold leading-tight text-white">{label}</span>
                <span className="h-[5px] w-[60%] rounded-[3px]" style={{ background: hue }} />
              </div>
            );
          })}
        </button>
      )}
    </div>
  );
}

/** Scattered research files — Unread · buried. */
export function ScatteredFilesVisual({ reduced, className, onActivate }: VisualProps) {
  const files = [
    { name: "interviews.docx", rot: -7, x: "4%", y: "6%" },
    { name: "survey-q3.xlsx", rot: 5, x: "48%", y: "0%" },
    { name: "usability.pdf", rot: -3, x: "18%", y: "34%" },
    { name: "notes.md", rot: 9, x: "54%", y: "38%" },
    { name: "deck.pptx", rot: -11, x: "28%", y: "66%" },
  ];
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "relative mx-auto h-full max-h-[440px] w-full max-w-md cursor-pointer border-0 bg-transparent p-0 text-left",
        className,
      )}
      aria-label="Five files. Tap one to start digging."
    >
      {files.map((f, i) => (
        <div
          key={f.name}
          className={cn(
            "absolute w-[42%] rounded-2xl border border-white/10 bg-[#12162a] p-3.5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.8)]",
            !reduced && "story-file-float",
          )}
          style={{
            left: f.x,
            top: f.y,
            transform: `rotate(${f.rot}deg)`,
            animationDelay: reduced ? undefined : `${i * 0.12}s`,
            zIndex: i + 1,
          }}
        >
          <p className="truncate font-mono text-[11px] font-medium text-white">{f.name}</p>
          <div className="mt-3 space-y-1.5">
            <span className="block h-1.5 w-full rounded bg-white/15" />
            <span className="block h-1.5 w-4/5 rounded bg-white/10" />
          </div>
          <p className="mt-3 text-[10px] font-semibold tracking-wide text-[#fbbf24]">Unread · buried</p>
        </div>
      ))}
    </button>
  );
}

/** Phone insight reel + 16:9 deck panel (Feed scene). */
export function ChannelPhoneVisual({ reduced, className }: VisualProps) {
  const [reel, setReel] = useState(0);
  const [liked, setLiked] = useState(false);
  const [heard, setHeard] = useState(false);
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const current = STORY_MEDIA.reels[reel]!;
  const addedIdx = STORY_MEDIA.reels.map((_, i) => i).filter((i) => added[i]);
  const deckN = addedIdx.length;

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setReel((r) => (r + 1) % STORY_MEDIA.reels.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div
      className={cn(
        "relative mx-auto flex h-full max-h-[560px] w-full max-w-2xl flex-wrap items-center justify-center gap-7",
        className,
      )}
    >
      <article className="slop-card slop-card-beam w-[320px] max-w-full overflow-hidden rounded-[36px] p-0">
        <div className="relative flex min-h-[560px] flex-col justify-between gap-5 overflow-hidden rounded-[34px] bg-[#020617] p-4 text-white">
          <MutedLoopVideo
            src={current.src}
            poster={current.poster}
            reduced={reduced}
            label="Stock footage of a person being interviewed"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(2,6,23,.72) 0%, rgba(2,6,23,.28) 26%, rgba(2,6,23,.5) 48%, rgba(2,6,23,.9) 74%)",
            }}
          />
          <div className="relative flex flex-col gap-3">
            <div aria-hidden className="flex gap-1">
              {STORY_MEDIA.reels.map((_, i) => (
                <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/30">
                  <span
                    className="block h-full bg-white transition-[width] duration-300"
                    style={{ width: i <= reel ? "100%" : "0%" }}
                  />
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-[38px] place-items-center rounded-full border-2 border-white text-[13px] font-extrabold"
                style={{ background: "linear-gradient(135deg, #f59e0b, #ec4899, #7e22ce)" }}
              >
                TR
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-bold">Team research</span>
                <span className="text-[12px] font-medium">
                  Insight scene {reel + 1} of {STORY_MEDIA.reels.length}
                </span>
              </span>
            </div>
          </div>
          <div className="relative flex items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
              <blockquote className="m-0 text-[25px] font-extrabold leading-[1.18] tracking-tight">
                {current.quote}
              </blockquote>
              <span className="text-[13px] font-medium">{current.who}</span>
              <span className="slop-badge slop-badge-ai whitespace-normal">Cut from {current.source}</span>
              {deckN === 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mb-5 mt-1.5 inline-flex items-center gap-1.5 self-end rounded-full bg-amber-300 px-2.5 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-slate-900 shadow-[0_0_24px_rgba(251,191,36,.55)]",
                    !reduced && "rf-nudge",
                  )}
                >
                  Add to deck
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M4 12h15" strokeLinecap="round" />
                    <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-3 text-[11px] font-semibold">
              <button
                type="button"
                aria-pressed={liked}
                aria-label="Like this scene"
                onClick={() => setLiked((v) => !v)}
                className="flex size-11 items-center justify-center rounded-full border-0 text-white"
                style={{ background: liked ? "#be185d" : "rgba(2,6,23,.45)" }}
              >
                ♥
              </button>
              <button
                type="button"
                aria-pressed={heard}
                aria-label="Mark as heard this before"
                onClick={() => setHeard((v) => !v)}
                className="flex size-11 items-center justify-center rounded-full border-0 text-white"
                style={{ background: heard ? "#047857" : "rgba(2,6,23,.45)" }}
              >
                ✓
              </button>
              <button
                type="button"
                aria-pressed={!!added[reel]}
                aria-label="Add this scene to the deck"
                onClick={() => setAdded((m) => ({ ...m, [reel]: !m[reel] }))}
                className="flex size-11 items-center justify-center rounded-full border-0 text-white"
                style={{ background: added[reel] ? "#6d28d9" : "rgba(2,6,23,.45)" }}
              >
                +
              </button>
            </div>
          </div>
          <div className="relative flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Previous scene"
              onClick={() => setReel((r) => (r + STORY_MEDIA.reels.length - 1) % STORY_MEDIA.reels.length)}
              className="flex size-11 items-center justify-center rounded-full border-0 bg-[rgba(2,6,23,.45)] text-white"
            >
              ↑
            </button>
            <span className="text-[13px] font-semibold">Swipe for the next scene</span>
            <button
              type="button"
              aria-label="Next scene"
              onClick={() => setReel((r) => (r + 1) % STORY_MEDIA.reels.length)}
              className="flex size-11 items-center justify-center rounded-full border-0 bg-[rgba(2,6,23,.45)] text-white"
            >
              ↓
            </button>
          </div>
        </div>
      </article>

      <div className="flex w-[260px] max-w-full flex-col gap-3">
        <div className="flex items-baseline justify-between font-mono text-[13px] tracking-[0.12em] text-slate-400 uppercase">
          <span className="text-slate-50">Deck</span>
          <span aria-live="polite">{deckN === 0 ? "Empty" : deckN === 1 ? "1 slide" : `${deckN} slides`}</span>
        </div>
        {deckN === 0 ? (
          <div className="flex aspect-video items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-violet-400/50 p-3.5 text-center text-[14px] text-slate-400">
            Add a scene to start a deck
          </div>
        ) : (
          <ol aria-label="Slides in the deck" className="m-0 flex list-none flex-col gap-3 p-0">
            {addedIdx.map((i, k) => {
              const s = STORY_MEDIA.reels[i]!;
              return (
                <li
                  key={i}
                  className={cn(
                    "box-border flex aspect-video flex-col gap-1.5 rounded bg-white px-3.5 pt-3 pb-2 text-slate-900 shadow-[0_12px_28px_rgba(0,0,0,.5)]",
                    !reduced && "rf-pop",
                  )}
                >
                  <span className="text-[14px] font-extrabold leading-tight tracking-tight">{s.title}</span>
                  <span aria-hidden className="h-[3px] w-9 rounded-sm bg-purple-700" />
                  <ul className="m-0 flex list-disc flex-col gap-0.5 py-0 pl-3.5 text-[11px] leading-snug text-slate-800">
                    <li>{s.short}</li>
                    <li>Who: {s.who}</li>
                    <li>Source: {s.source}</li>
                  </ul>
                  <span className="mt-auto flex justify-between gap-2 text-[10px] text-slate-600">
                    <span>repofeed · Team research</span>
                    <span>{k + 1}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <span className="text-[14px] text-slate-400">The best scenes export to PowerPoint.</span>
      </div>
    </div>
  );
}

/**
 * Demo step “What you get” card.
 * Intentional product-accurate edits vs the SlopMain artboard:
 * - iOS-only (not “iOS and Android”) — Android app is not shipping yet.
 * - Dropped “Your files never leave your servers” — files are read in-browser;
 *   extracted text is sent to our servers, so that claim is not accurate.
 */
export function DemoWhatYouGetCard({ className }: { className?: string }) {
  const items = [
    {
      icon: "📂",
      iconClass: "slop-icon-cyan",
      title: "Just upload your files",
      body: "Any research files, any format — repofeed does the work from there.",
    },
    {
      icon: "✨",
      iconClass: "",
      title: "AI builds the reels and the decks",
      body: "Insight reels and PowerPoint decks, created automatically from your findings.",
    },
    {
      icon: "📱",
      iconClass: "slop-icon-pink",
      title: "A channel in every stakeholder’s pocket",
      // Artboard said “iOS and Android apps…” — product is iOS-only today.
      body: "The iOS app streams your insights on dedicated research channels.",
    },
    // Artboard also listed “Your files never leave your servers” — omitted on purpose.
  ];

  return (
    <div className={cn("slop-card slop-card-beam flex w-full max-w-[440px] flex-col gap-5 p-7", className)}>
      <span className="slop-row">
        <span className="slop-icon-box slop-icon-cyan mb-0" aria-hidden>
          🎬
        </span>
        <span className="font-mono text-[13px] tracking-[0.12em] text-slate-400 uppercase">What you get</span>
      </span>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3.5">
            <span className={cn("slop-icon-box mb-0 shrink-0", item.iconClass)} aria-hidden>
              {item.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[16px] font-bold leading-snug">{item.title}</span>
              <span className="text-[14px] leading-snug text-slate-300">{item.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Live channel preview card used on setup + ready steps. */
export function ChannelPreviewCard({
  session,
  status = "setting",
  showNext = false,
  className,
}: {
  session: StorySession;
  status?: "setting" | "air";
  showNext?: boolean;
  className?: string;
}) {
  const tuned = session.role ? ROLE_LABELS[session.role] : "Not set yet";
  const onAir =
    session.researchKinds.length > 0 ? session.researchKinds.join(" · ") : "Not set yet";
  const watching = session.audience ?? "Not set yet";
  const title = session.channelName.trim() || "Unnamed channel.";

  return (
    <aside className={cn("slop-card slop-card-beam w-full max-w-md p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--slop-text-muted)] uppercase">
          Channel preview
        </p>
        <span className={cn("slop-pill", status === "air" ? "slop-pill-green" : "")}>
          <span className={cn("slop-dot", status === "air" ? "slop-dot-green" : "slop-dot-amber")} />
          {status === "air" ? "On air" : "Setting up"}
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">{title}</h2>
      <dl className="mt-5 divide-y divide-white/10 text-sm">
        {(
          [
            ["Tuned for", tuned],
            ["On air", onAir],
            ["Watching", watching],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[var(--slop-text-muted)]">{label}</dt>
            <dd
              className={cn(
                "text-right font-medium",
                value === "Not set yet" ? "text-[var(--slop-text-dim)]" : "",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {showNext && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--slop-text-muted)] uppercase">
            What happens next
          </p>
          <ol className="mt-3 space-y-2.5">
            {[
              "Upload your research files",
              "AI cuts them into short insight scenes",
              "Your team scrolls, likes and comments",
              "The best scenes go to a PowerPoint deck",
            ].map((line, i) => (
              <li key={line} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-[#030712]">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
