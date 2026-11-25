import { cn } from "@/lib/utils.ts";

type VisualProps = {
  reduced: boolean;
  className?: string;
};

/** Retro CRT television with scanlines — shared narrative at 8pm. */
export function CrtTvVisual({ reduced, className }: VisualProps) {
  return (
    <div className={cn("relative mx-auto flex h-full max-h-[420px] w-full max-w-md items-center justify-center", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(29,99,224,0.18),transparent_65%)]" />
      <div
        className={cn(
          "relative aspect-[4/3] w-[78%] rounded-[1.25rem] border-[10px] border-[#1a1f2a] bg-[#0c1018] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]",
          !reduced && "story-crt-glow",
        )}
      >
        <div className="absolute inset-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#1d63e0]/40 via-[#0f8f8a]/30 to-[#10151f]">
          <div className={cn("absolute inset-0 opacity-40", !reduced && "story-scanlines")} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-serif text-lg leading-snug text-white/95 sm:text-xl">8:00 PM</p>
            <p className="text-xs font-medium tracking-wide text-white/70 uppercase">Everyone watching</p>
            <div className="mt-3 flex -space-x-2">
              {["#ffe066", "#1d63e0", "#0f8f8a", "#f1f3f7"].map((c) => (
                <span key={c} className="size-7 rounded-full border-2 border-[#0c1018]" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute -bottom-3 left-1/2 h-3 w-16 -translate-x-1/2 rounded-b-md bg-[#1a1f2a]" />
        <div className="absolute -bottom-5 left-1/2 h-2 w-28 -translate-x-1/2 rounded-full bg-[#12161f]" />
      </div>
    </div>
  );
}

/** One screen fracturing into personal algorithm bubbles. */
export function ShatterVisual({ reduced, className }: VisualProps) {
  const tiles = [
    { x: -38, y: -28, r: -12, label: "For you" },
    { x: 34, y: -32, r: 10, label: "Trending" },
    { x: -42, y: 18, r: 8, label: "Your mix" },
    { x: 40, y: 22, r: -9, label: "Up next" },
    { x: -8, y: 36, r: 4, label: "Suggested" },
    { x: 6, y: -40, r: -6, label: "Continue" },
  ];
  return (
    <div className={cn("relative mx-auto flex h-full max-h-[420px] w-full max-w-md items-center justify-center", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,50,43,0.12),transparent_60%)]" />
      <div className="relative size-40 rounded-2xl border border-white/10 bg-[#12161f] shadow-sheet sm:size-48">
        <div className="absolute inset-3 rounded-xl bg-gradient-to-br from-[#586172] to-[#10151f] opacity-80" />
        <p className="absolute inset-0 grid place-items-center text-xs font-semibold text-white/50">One feed</p>
      </div>
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={cn(
            "absolute w-24 rounded-xl border border-white/15 bg-[#1a2030]/95 px-2.5 py-2 shadow-lift backdrop-blur-sm sm:w-28",
            !reduced && "story-tile-drift",
          )}
          style={{
            transform: `translate(${t.x}%, ${t.y}%) rotate(${t.r}deg)`,
            animationDelay: reduced ? undefined : `${i * 0.12}s`,
          }}
        >
          <span className="block h-1.5 w-8 rounded-full bg-white/25" />
          <span className="mt-2 block text-[10px] font-semibold tracking-wide text-white/80 uppercase">{t.label}</span>
          <span className="mt-1 block h-8 rounded-md bg-gradient-to-br from-white/10 to-transparent" />
        </div>
      ))}
    </div>
  );
}

/** Scattered research files nobody opens. */
export function ScatteredFilesVisual({ reduced, className }: VisualProps) {
  const files = [
    { name: "interviews.docx", rot: -8, x: "8%", y: "18%" },
    { name: "survey-q3.xlsx", rot: 6, x: "52%", y: "12%" },
    { name: "usability.pdf", rot: -3, x: "22%", y: "48%" },
    { name: "notes.md", rot: 11, x: "58%", y: "52%" },
    { name: "deck.pptx", rot: -14, x: "38%", y: "72%" },
  ];
  return (
    <div className={cn("relative mx-auto h-full max-h-[420px] w-full max-w-md", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,100,0,0.14),transparent_65%)]" />
      {files.map((f, i) => (
        <div
          key={f.name}
          className={cn(
            "absolute w-36 rounded-lg border border-border bg-card p-3 shadow-lift sm:w-40",
            !reduced && "story-file-float",
          )}
          style={{
            left: f.x,
            top: f.y,
            transform: `rotate(${f.rot}deg)`,
            animationDelay: reduced ? undefined : `${i * 0.15}s`,
          }}
        >
          <p className="truncate text-xs font-semibold text-foreground">{f.name}</p>
          <div className="mt-2 space-y-1.5">
            <span className="block h-1.5 w-full rounded bg-muted" />
            <span className="block h-1.5 w-4/5 rounded bg-muted" />
            <span className="block h-1.5 w-3/5 rounded bg-muted" />
          </div>
          <p className="mt-2 text-[10px] font-medium text-warning">Unread · buried</p>
        </div>
      ))}
    </div>
  );
}

/** Tiles reassembling into one phone-shaped insight feed. */
export function ReassembleVisual({ reduced, className }: VisualProps) {
  return (
    <div className={cn("relative mx-auto flex h-full max-h-[420px] w-full max-w-md items-center justify-center", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(29,99,224,0.22),transparent_60%)]" />
      {[
        { x: -70, y: -50, delay: 0 },
        { x: 75, y: -40, delay: 0.08 },
        { x: -80, y: 40, delay: 0.16 },
        { x: 85, y: 50, delay: 0.24 },
      ].map((t, i) => (
        <span
          key={i}
          className={cn(
            "absolute size-10 rounded-lg border border-primary/40 bg-primary/20 sm:size-12",
            !reduced && "story-tile-assemble",
          )}
          style={{
            ["--tx" as string]: `${t.x}px`,
            ["--ty" as string]: `${t.y}px`,
            animationDelay: reduced ? undefined : `${t.delay}s`,
          }}
        />
      ))}
      <div
        className={cn(
          "dark relative w-[42%] max-w-[180px] overflow-hidden rounded-[1.6rem] border-[5px] border-[#16131f] bg-black shadow-sheet",
          !reduced && "story-phone-rise",
        )}
      >
        <div className="aspect-[9/16] bg-gradient-to-b from-[#1d63e0]/50 via-[#0a0d13] to-[#0a0d13] p-4">
          <p className="text-[10px] font-semibold tracking-wide text-white/50 uppercase">Insight scene</p>
          <p className="mt-3 font-serif text-[0.95rem] leading-snug text-white">
            “It stopped feeling like help and started feeling like homework.”
          </p>
          <p className="mt-2 text-[10px] text-white/55">Parent of two · 7 months</p>
          <div className="mt-auto absolute inset-x-4 bottom-4 flex gap-1.5">
            <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-medium text-white/80">Heard this</span>
            <span className="rounded-full bg-mark px-2 py-1 text-[9px] font-semibold text-mark-foreground">Add to deck</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple how-it-works pipeline. */
export function HowItWorksVisual({ reduced, className }: VisualProps) {
  const steps = [
    { n: "1", title: "Upload", body: "Research files" },
    { n: "2", title: "AI scenes", body: "Short insights" },
    { n: "3", title: "Scroll", body: "Like · comment" },
    { n: "4", title: "Deck", body: "Best ones → PPT" },
  ];
  return (
    <div className={cn("relative mx-auto flex h-full max-h-[420px] w-full max-w-lg items-center justify-center px-2", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,143,138,0.16),transparent_65%)]" />
      <ol className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className={cn(
              "rounded-2xl border border-border bg-card/90 p-3 shadow-lift backdrop-blur-sm",
              !reduced && "story-step-in",
            )}
            style={{ animationDelay: reduced ? undefined : `${i * 0.1}s` }}
          >
            <span className="grid size-7 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
              {s.n}
            </span>
            <p className="mt-2 text-sm font-semibold text-foreground">{s.title}</p>
            <p className="text-xs text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Ready state — channel live. */
export function ReadyVisual({ reduced, channelName, className }: VisualProps & { channelName: string }) {
  return (
    <div className={cn("relative mx-auto flex h-full max-h-[420px] w-full max-w-md items-center justify-center", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(18,128,92,0.2),transparent_60%)]" />
      <div
        className={cn(
          "w-full max-w-xs rounded-3xl border border-border bg-card p-6 text-center shadow-sheet",
          !reduced && "story-phone-rise",
        )}
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success text-lg font-bold text-white">✓</span>
        <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Channel live</p>
        <p className="mt-1 font-serif text-2xl text-foreground">{channelName || "Your channel"}</p>
        <p className="mt-2 text-sm text-muted-foreground">A common feed of insight scenes for everyone who needs to know.</p>
      </div>
    </div>
  );
}
