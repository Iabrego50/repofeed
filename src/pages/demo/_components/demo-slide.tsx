import { useState } from "react";
import { Play } from "lucide-react";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";
import type { PanelTab } from "@/pages/feed/_components/reel-panel.tsx";
import SceneActions from "@/pages/feed/_components/scene-actions.tsx";

type Props = {
  reel: ReelData;
  /** Only the slide in view (and its neighbours) mount a canvas. */
  mounted: boolean;
  active: boolean;
  onEnded: () => void;
  hearted: boolean;
  hearts: number;
  saved: boolean;
  commentCount: number;
  onHeart: () => void;
  onSave: () => void;
  onOpenPanel: (tab: PanelTab) => void;
  showHints?: boolean;
  onDismissHints?: () => void;
};

/** One full-height demo scene with tap-to-pause, a progress bar, and feed-style actions. */
export default function DemoSlide({
  reel,
  mounted,
  active,
  onEnded,
  hearted,
  hearts,
  saved,
  commentCount,
  onHeart,
  onSave,
  onOpenPanel,
  showHints,
  onDismissHints,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const playing = active && !paused;

  if (!mounted)
    return <div className="h-full w-full snap-start bg-black" aria-hidden />;

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
      <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-end p-4 pb-5">
        <div className="pointer-events-auto">
          <SceneActions
            hearted={hearted}
            hearts={hearts}
            onHeart={onHeart}
            commentCount={commentCount}
            onComment={() => onOpenPanel("discussion")}
            saved={saved}
            onSave={onSave}
            onEvidence={() => onOpenPanel("evidence")}
            hints={
              showHints
                ? {
                    react: "React if this rings true",
                    comment: "Ask a question",
                    evidence: "See the evidence",
                  }
                : undefined
            }
            onDismissHints={showHints ? onDismissHints : undefined}
          />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/15">
        <div
          className="h-full bg-primary transition-[width] duration-100"
          style={{ width: `${active ? progress * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
