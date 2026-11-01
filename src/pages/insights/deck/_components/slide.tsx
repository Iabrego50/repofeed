import type { ReactNode } from "react";
import { Quote } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { CompletionChart, ReactionsChart, ViewsChart } from "./slide-charts.tsx";
import { COLORS, KICKERS, headlineStats, kickerFor, pct, type Deck, type DeckSlide } from "../_lib/deck.ts";

type Props = { deck: Deck; slide: DeckSlide; index: number; total: number; animate: boolean };

/** Fixed 1280×720 slide. Parent scales it to fit the screen. */
export default function Slide({ deck, slide, index, total, animate }: Props) {
  if (slide.type === "title" || slide.type === "closing") {
    return <CoverSlide deck={deck} slide={slide} />;
  }
  return (
    <div className="relative flex h-[720px] w-[1280px] flex-col overflow-hidden bg-[#070B14] px-[88px] pb-[56px] pt-[72px] text-[#EEF3FB]">
      <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-[#2F9BFF]/[0.07] blur-3xl" />
      <p className="font-mono text-[15px] font-bold uppercase tracking-[0.2em] text-[#2F9BFF]">{kickerFor(deck, index)}</p>
      <h2 className="mt-4 max-w-[1000px] text-balance font-display text-[50px] font-extrabold leading-[1.05] tracking-tight">{slide.headline}</h2>
      {slide.body && <p className="mt-5 max-w-[880px] text-[22px] leading-snug text-[#93A0B8]">{slide.body}</p>}
      <div className="relative mt-10 min-h-0 flex-1">
        <SlideBody deck={deck} slide={slide} animate={animate} />
      </div>
      <footer className="mt-6 flex items-center justify-between font-mono text-[14px] text-[#5B6782]">
        <span>{deck.scopeLabel}</span>
        <span>{index + 1} / {total}</span>
      </footer>
    </div>
  );
}

function SlideBody({ deck, slide, animate }: { deck: Deck; slide: DeckSlide; animate: boolean }): ReactNode {
  switch (slide.type) {
    case "summary":
      return (
        <ol className="flex h-full flex-col justify-start gap-4">
          {slide.items?.map((item: string, i: number) => (
            <li key={i} className="flex items-center gap-6 border-t border-[#1F2A40] pt-4">
              <span className="w-14 shrink-0 font-display text-[40px] font-extrabold leading-none text-[#2F9BFF] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[28px] leading-snug">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "finding":
      return <Finding deck={deck} slide={slide} />;
    case "figures":
      return (
        <div className="grid h-full gap-6" style={{ gridTemplateColumns: `repeat(${slide.stats?.length ?? 1}, minmax(0, 1fr))` }}>
          {slide.stats?.map((s, i) => (
            <div key={i} className="flex flex-col justify-end rounded-3xl border border-[#1F2A40] bg-[#0E1422] p-8">
              <p className="font-display text-[84px] font-extrabold leading-none tabular-nums" style={{ color: i === 0 ? COLORS.coral : COLORS.fg }}>{s.num}</p>
              <p className="mt-4 line-clamp-3 text-[22px] leading-snug text-[#93A0B8]">{s.label}</p>
            </div>
          ))}
        </div>
      );
    case "numbers":
      return (
        <div className="grid h-full grid-cols-4 gap-6">
          {headlineStats(deck).map((s, i) => (
            <div key={s.label} className="flex flex-col justify-end rounded-3xl border border-[#1F2A40] bg-[#0E1422] p-8">
              <p className="font-mono text-[14px] font-bold uppercase tracking-wider text-[#93A0B8]">{s.label}</p>
              <p className="mt-3 font-display text-[64px] font-extrabold leading-none tabular-nums" style={{ color: i === 0 ? COLORS.coral : COLORS.fg }}>{s.value}</p>
              <p className="mt-3 text-[18px] text-[#93A0B8]">{s.sub}</p>
            </div>
          ))}
        </div>
      );
    case "reach":
      return <ViewsChart deck={deck} animate={animate} />;
    case "completion":
      return <CompletionChart deck={deck} animate={animate} />;
    case "reactions":
      return <ReactionsChart deck={deck} animate={animate} />;
    case "spotlight":
      return <Spotlight deck={deck} title={slide.reelTitle ?? ""} />;
    case "voices":
      return (
        <div className={`grid h-full gap-6 ${(slide.quotes?.length ?? 0) > 1 ? "grid-cols-2" : "grid-cols-1"} ${(slide.quotes?.length ?? 0) > 2 ? "grid-cols-3" : ""}`}>
          {slide.quotes?.map((q, i) => (
            <figure key={i} className="flex flex-col rounded-3xl border border-[#1F2A40] bg-[#0E1422] p-8">
              <Quote className="size-9 text-[#2F9BFF]" />
              <blockquote className="mt-4 line-clamp-6 flex-1 text-[24px] leading-snug">{q.text}</blockquote>
              <figcaption className="mt-4 font-mono text-[15px] text-[#93A0B8]">{q.by}</figcaption>
            </figure>
          ))}
        </div>
      );
    case "next_steps":
      return (
        <ol className="grid h-full grid-cols-2 content-start gap-5">
          {slide.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-5 rounded-3xl border border-[#1F2A40] bg-[#0E1422] p-7">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#2F9BFF] font-display text-[22px] font-extrabold text-[#070B14]">{i + 1}</span>
              <span className="pt-1.5 text-[24px] leading-snug">{item}</span>
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

function Finding({ deck, slide }: { deck: Deck; slide: DeckSlide }) {
  const stats = slide.stats ?? [];
  const quote = slide.quotes?.[0];
  const reel = slide.reelTitle ? deck.reels.find((r) => r.title === slide.reelTitle) : undefined;
  // A response line of all zeros adds noise, not evidence.
  const showReel = reel !== undefined && reel.trueCount + reel.surprisedCount + reel.pushbackCount > 0;
  // Narrow quote cards (beside two figures) need smaller type so long quotes fit.
  const quoteSize = quote && (stats.length > 1 || quote.text.length > 90) ? "text-[22px] line-clamp-6" : "text-[30px] line-clamp-5";
  if (!stats.length && !quote) return null;
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex min-h-0 flex-1 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="flex w-[300px] shrink-0 flex-col justify-end rounded-3xl border border-[#1F2A40] bg-[#0E1422] p-8">
            <p className="font-display text-[68px] font-extrabold leading-none tabular-nums" style={{ color: i === 0 ? COLORS.coral : COLORS.fg }}>{s.num}</p>
            <p className="mt-3 line-clamp-3 text-[19px] leading-snug text-[#93A0B8]">{s.label}</p>
          </div>
        ))}
        {quote && (
          <figure className="flex min-w-0 flex-1 flex-col justify-center rounded-3xl bg-gradient-to-br from-[#2F9BFF] to-[#1E5BFF] p-9 text-[#070B14]">
            <Quote className="size-9 opacity-70" />
            <blockquote className={`mt-3 font-display font-bold leading-[1.15] ${quoteSize}`}>{quote.text}</blockquote>
            <figcaption className="mt-4 font-mono text-[15px] font-bold uppercase tracking-wider opacity-75">{quote.by}</figcaption>
          </figure>
        )}
      </div>
      {showReel && reel && (
        <p className="font-mono text-[15px] text-[#5B6782]">
          Team response to &ldquo;{reel.title}&rdquo;: <span className="text-[#3FE0A0]">{reel.trueCount} rings true</span> · <span className="text-[#FFC23D]">{reel.surprisedCount} surprised</span> · <span className="text-[#FF5A5F]">{reel.pushbackCount} push back</span>
        </p>
      )}
    </div>
  );
}

function Spotlight({ deck, title }: { deck: Deck; title: string }) {
  const reel = deck.reels.find((r) => r.title === title);
  if (!reel) return null;
  const stats = [
    { label: "People", value: reel.viewers.toLocaleString(), color: COLORS.fg },
    { label: "Finished", value: pct(reel.completionRate), color: COLORS.fg },
    { label: "Rings true", value: String(reel.trueCount), color: COLORS.green },
    { label: "Surprised me", value: String(reel.surprisedCount), color: COLORS.amber },
    { label: "Push back", value: String(reel.pushbackCount), color: COLORS.red },
    { label: "Comments", value: String(reel.commentCount), color: COLORS.fg },
  ];
  return (
    <div className="flex h-full gap-8">
      <div className="flex w-[360px] shrink-0 flex-col justify-between rounded-3xl bg-gradient-to-br from-[#2F9BFF] to-[#1E5BFF] p-8 text-[#070B14]">
        <p className="font-mono text-[14px] font-bold uppercase tracking-wider opacity-80">{reel.track}</p>
        <p className="font-display text-[38px] font-extrabold leading-[1.05]">{reel.title}</p>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-5">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col justify-center rounded-3xl border border-[#1F2A40] bg-[#0E1422] px-7">
            <p className="font-display text-[48px] font-extrabold leading-none tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="mt-2 text-[18px] text-[#93A0B8]">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverSlide({ deck, slide }: { deck: Deck; slide: DeckSlide }) {
  const isTitle = slide.type === "title";
  const date = new Date(deck._creationTime).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="relative flex h-[720px] w-[1280px] flex-col justify-between overflow-hidden bg-[#070B14] p-[88px] text-[#EEF3FB]">
      <div className="absolute -bottom-56 -right-32 size-[760px] rounded-full bg-[#2F9BFF]/20 blur-3xl" />
      <div className="absolute right-[120px] top-[110px] h-[420px] w-[236px] rotate-6 rounded-[36px] border border-[#2F9BFF]/40 bg-gradient-to-b from-[#2F9BFF]/25 to-transparent" />
      <div className="absolute right-[230px] top-[150px] h-[420px] w-[236px] -rotate-3 rounded-[36px] border border-[#1F2A40] bg-[#0E1422]/80" />
      <div className="relative"><Logo /></div>
      <div className="relative max-w-[760px]">
        <p className="font-mono text-[15px] font-bold uppercase tracking-[0.2em] text-[#2F9BFF]">{KICKERS[slide.type]}</p>
        <h1 className="mt-5 text-balance font-display text-[72px] font-extrabold leading-[1] tracking-tight">{slide.headline}</h1>
        {slide.body && <p className="mt-6 text-[26px] leading-snug text-[#93A0B8]">{slide.body}</p>}
      </div>
      <p className="relative font-mono text-[15px] text-[#5B6782]">{isTitle ? `${deck.scopeLabel} · ${date}` : "Made with repofeed.ai"}</p>
    </div>
  );
}
