import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils.ts";
import { DEMO_REELS, DEMO_TRACKS } from "@/pages/demo/_lib/demo-reels.ts";

const STUDY = "Supperly Meal-Kit Cancellation Study";

const FEED_TITLES = [
  "Why people really leave",
  "The forgotten skip",
  "30 minutes takes 50",
  "The hidden cancel button",
  "Kits that never get cooked",
];

const SAMPLE_REELS: ReelData[] = FEED_TITLES.map((title) => DEMO_REELS.find((r) => r.title === title))
  .filter((r): r is (typeof DEMO_REELS)[number] => !!r)
  .map((r) => ({
    title: r.title,
    track: DEMO_TRACKS[r.track],
    trackIndex: r.track,
    studyTitle: STUDY,
    scenes: r.scenes,
    footage: r.footage,
  }));

/** Horizontal strip of five demo scenes rendered with the real reel canvas. */
export default function SampleFeed() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const nearObs = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), {
      rootMargin: "600px",
    });
    const viewObs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    nearObs.observe(el);
    viewObs.observe(el);
    return () => {
      nearObs.disconnect();
      viewObs.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:gap-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0"
    >
      {SAMPLE_REELS.map((reel, i) => (
        <Link
          key={reel.title}
          to="/demo"
          onClick={() => track("demo_open", { location: "feed_strip", reel: reel.title })}
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
          aria-label={`${reel.title}. Open the demo feed.`}
          className="group block w-[62vw] max-w-[260px] shrink-0 cursor-pointer snap-center rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring lg:w-auto lg:max-w-none"
        >
          <div className="dark aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black">
            {near && (
              <ReelCanvas
                reel={reel}
                playing={inView && i === active}
                stillAt={0.9}
                fit="cover"
                restartKey={i === active ? "on" : "off"}
                onEnded={() => setActive((cur) => (cur === i ? (i + 1) % SAMPLE_REELS.length : cur))}
                className="size-full"
              />
            )}
          </div>
          <span
            aria-hidden
            className={cn(
              "mx-auto mt-3 block h-1 w-10 rounded-full transition-colors",
              i === active ? "bg-foreground" : "bg-border group-hover:bg-muted-foreground",
            )}
          />
        </Link>
      ))}
    </div>
  );
}
