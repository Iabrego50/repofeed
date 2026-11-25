import { cn } from "@/lib/utils.ts";
import type { StoryAnswers } from "@/lib/story-onboarding.ts";
import { RESEARCH_LABELS, ROLE_LABELS, SHARE_LABELS } from "@/lib/story-onboarding.ts";

type VisualProps = {
  reduced: boolean;
  className?: string;
  onActivate?: () => void;
};

/** Retro CRT — dark until tapped / Turn it on. */
export function CrtTvVisual({ reduced, className, onActivate }: VisualProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "relative mx-auto flex h-full max-h-[440px] w-full max-w-md cursor-pointer items-center justify-center border-0 bg-transparent p-0",
        className,
      )}
      aria-label="Tap to turn it on"
    >
      <div
        className={cn(
          "relative aspect-[5/4] w-[86%] rounded-[1.4rem] border-[3px] border-[#1e2436] bg-[#0c101c]",
          !reduced && "story-crt-glow",
        )}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center gap-3 rounded-lg bg-[#080a12]">
          <span className="grid size-10 place-items-center rounded-full border border-white/25 text-white/80">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v8" strokeLinecap="round" />
              <path d="M7.5 6.5a7 7 0 1 0 9 0" strokeLinecap="round" />
            </svg>
          </span>
          <p className="text-[11px] font-medium tracking-[0.12em] text-white/55 uppercase">Tap to turn it on</p>
        </div>
        <div className="absolute inset-x-8 bottom-5 grid grid-cols-10 gap-1.5">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="aspect-square rounded-full bg-[#1a2240]" />
          ))}
        </div>
      </div>
    </button>
  );
}

/** Glowing yellow digital screen — change the channel. */
export function YellowScreenVisual({ reduced, className, onActivate }: VisualProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "relative mx-auto flex h-full max-h-[440px] w-full max-w-md cursor-pointer items-center justify-center border-0 bg-transparent p-0",
        className,
      )}
      aria-label="Tap to change the channel"
    >
      <div className="relative w-[88%]">
        <div
          className={cn(
            "aspect-[16/10] rounded-[1.35rem] border-[3px] border-[#1a1f2e] bg-[#facc15]",
            !reduced && "story-yellow-glow",
          )}
        >
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="font-mono text-4xl font-bold tracking-tight text-[#0b1020] sm:text-5xl">8:00 PM</p>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#0b1020]/70 uppercase">
              Tap to change the channel
            </p>
          </div>
        </div>
        <div className="mx-auto mt-4 grid w-[70%] grid-cols-8 gap-2">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="aspect-square rounded-full bg-[#facc15]/90 shadow-[0_0_12px_rgba(250,204,21,0.35)]" />
          ))}
        </div>
      </div>
    </button>
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
          <p className="mt-3 text-[10px] font-semibold tracking-wide text-[#facc15]">Unread · buried</p>
        </div>
      ))}
    </button>
  );
}

/** Phone insight scene + empty deck panel (screen 04). */
export function ChannelPhoneVisual({ reduced, className }: VisualProps) {
  return (
    <div className={cn("relative mx-auto flex h-full max-h-[480px] w-full max-w-lg items-center justify-center gap-4", className)}>
      <div
        className={cn(
          "dark relative w-[48%] max-w-[200px] overflow-hidden rounded-[1.75rem] border-[5px] border-[#0f172a] bg-[#0f172a] shadow-sheet",
          !reduced && "story-phone-rise",
        )}
      >
        <div className="aspect-[9/16] bg-[#0f172a] p-4">
          <p className="font-mono text-[9px] tracking-[0.14em] text-white/45 uppercase">Insight scene</p>
          <p className="mt-4 font-serif text-[1.05rem] leading-snug text-white">
            “It stopped feeling like help and started feeling like homework.”
          </p>
          <p className="mt-3 text-[10px] text-white/50">Parent of two • 7 months</p>
          <span className="mt-4 inline-flex rounded-full bg-white/10 px-2.5 py-1 font-mono text-[9px] text-white/80">
            Cut from interviews.docx
          </span>
          <div className="absolute inset-x-4 bottom-4 flex gap-2">
            <span className="rounded-full bg-white/12 px-2.5 py-1.5 text-[9px] font-medium text-white/85">Heard this</span>
            <span className="rounded-full bg-mark px-2.5 py-1.5 text-[9px] font-semibold text-mark-foreground">
              Add to deck
            </span>
          </div>
        </div>
      </div>
      <div className="hidden w-[42%] flex-col sm:flex">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          <span>Deck</span>
          <span>Empty</span>
        </div>
        <div className="mt-3 flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-border bg-white/60 px-4 text-center text-sm text-muted-foreground">
          Add a scene to start a deck.
        </div>
        <p className="mt-3 text-xs text-muted-foreground">The best scenes export to PowerPoint.</p>
      </div>
    </div>
  );
}

/** Live channel preview card used on setup + ready steps. */
export function ChannelPreviewCard({
  answers,
  status = "setting",
  showNext = false,
  className,
}: {
  answers: StoryAnswers;
  status?: "setting" | "air";
  showNext?: boolean;
  className?: string;
}) {
  const tuned = answers.role ? ROLE_LABELS[answers.role] : "Not set yet";
  const onAir =
    answers.researchKinds.length > 0
      ? answers.researchKinds.map((k) => RESEARCH_LABELS[k]).join(" · ")
      : "Not set yet";
  const watching = answers.shareAudience ? SHARE_LABELS[answers.shareAudience] : "Not set yet";
  const title = answers.channelName.trim() || "Unnamed channel.";

  return (
    <aside
      className={cn(
        "w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6 shadow-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Channel preview</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            status === "air" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {status === "air" ? "On air" : "Setting up"}
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      <dl className="mt-5 divide-y divide-border text-sm">
        {(
          [
            ["Tuned for", tuned],
            ["On air", onAir],
            ["Watching", watching],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("text-right font-medium", value === "Not set yet" ? "text-muted-foreground" : "text-foreground")}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {showNext && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">What happens next</p>
          <ol className="mt-3 space-y-2.5">
            {[
              "Upload your research files",
              "AI cuts them into short insight scenes",
              "Your team scrolls, likes and comments",
              "The best scenes go to a PowerPoint deck",
            ].map((line, i) => (
              <li key={line} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
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
