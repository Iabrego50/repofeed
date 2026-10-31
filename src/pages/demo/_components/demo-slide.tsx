import { useState } from "react";
import { Play } from "lucide-react";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";

type Props = {
  reel: ReelData;
  /** Only the slide in view (and its neighbours) mount a canvas. */
  mounted: boolean;
  active: boolean;
  onEnded: () => void;
};

/** One full-height demo scene with tap-to-pause and a thin progress bar. */
export default function DemoSlide({ reel, mounted, active, onEnded }: Props) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const playing = active && !paused;

  if (!mounted) return <div className="h-full w-full snap-start bg-black" aria-hidden />;

  return (
    <div className="relative h-full w-full snap-start snap-always bg-black">
      <ReelCanvas
        reel={reel}
        playing={playing}
        stillAt={0.6}
        restartKey={active ? "on" : "off"}
        fit="cover"
        onEnded={onEnded}
        onProgress={(t, total) => setProgress(total ? t / total : 0)}
        className="h-full w-full"
      />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={playing ? "Pause scene" : "Play scene"}
        className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center"
      >
        {active && paused && (
          <span className="grid size-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
            <Play className="size-7 translate-x-0.5" />
          </span>
        )}
      </button>
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/15">
        <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${active ? progress * 100 : 0}%` }} />
      </div>
    </div>
  );
}
