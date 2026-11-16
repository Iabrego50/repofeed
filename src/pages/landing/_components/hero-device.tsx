import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";
import { track } from "@/lib/analytics";

const PREVIEW: ReelData = {
  title: "Help that became homework",
  track: "What customers say",
  trackIndex: 0,
  studyTitle: "Supperly Meal-Kit Cancellation Study",
  scenes: [
    {
      type: "quote",
      text: "It stopped feeling like help and started feeling like homework.",
      by: "Parent of two, 7 months",
    },
    { type: "stat", num: "7 of 10", label: "said it started to feel like an obligation" },
    { type: "cta", text: "Obligation is the *churn signal*.", sub: "Source: supperly-cancel-interviews.txt" },
    { type: "hook", text: "When does a meal kit stop *helping*?" },
  ],
  footage: { url: "/footage/mother-cooking.mp4", caption: "Home visit · P07 · Day 3" },
};

/** Tilted transcript page with a phone mockup of a real scene cycling over it. */
export default function HeroDevice() {
  return (
    <div className="relative mx-auto w-full max-w-[540px] lg:mx-0 lg:ml-auto">
      <figure
        aria-label="A page of an interview transcript"
        className="w-[72%] -rotate-[2.5deg] rounded-lg bg-card p-5 shadow-sheet sm:p-7"
      >
        <figcaption className="flex items-center justify-between gap-3 border-b border-border pb-3 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">supperly-cancel-interviews.txt</span>
          <span className="shrink-0">10 interviews</span>
        </figcaption>
        <div className="mt-4 space-y-3 font-serif text-[0.8125rem] leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          <p className="font-sans text-xs font-semibold text-foreground">C1, parent of two, subscribed 7 months</p>
          <p>
            “The box shows up Tuesday and by Thursday I’m staring at three bags of vegetables I feel guilty about.”
          </p>
          <p className="text-foreground">
            <span className="hl">“It stopped feeling like help and started feeling like homework.”</span>
          </p>
          <p className="font-sans text-xs font-semibold text-foreground">
            C2, single professional, subscribed 3 months
          </p>
          <p>
            “I skipped four weeks in a row and kept forgetting to skip the fifth. That’s when I cancelled.”
          </p>
          <p className="max-sm:hidden">
            “The skip deadline is Wednesday at midnight. My life does not run on Wednesday at midnight.”
          </p>
        </div>
      </figure>
      <div className="relative -mt-[62%] ml-auto w-[48%] sm:-mt-[56%] sm:w-[46%]">
        <span className="absolute -top-3 -left-4 z-10 -rotate-3 rounded-sm bg-mark px-2 py-1 text-xs font-semibold whitespace-nowrap text-mark-foreground shadow-lift">
          Line 11, now a scene
        </span>
        <Link
          to="/demo"
          onClick={() => track("demo_open", { location: "hero_device" })}
          aria-label="Watch the demo feed"
          className="dark group relative block cursor-pointer overflow-hidden rounded-[1.75rem] border-[5px] border-[#16131f] bg-black shadow-sheet outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ReelCanvas reel={PREVIEW} playing fit="cover" className="aspect-[9/16] w-full" />
          <span className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/80 to-transparent p-4 pt-14">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-black transition-transform group-hover:scale-[1.03]">
              <Play className="size-3.5 fill-current" /> Watch the demo
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
