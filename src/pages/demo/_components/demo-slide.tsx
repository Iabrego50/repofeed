import { useRef, useState } from "react";
import { Play } from "lucide-react";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { PanelTab } from "@/pages/feed/_components/reel-panel.tsx";
import SceneActions from "@/pages/feed/_components/scene-actions.tsx";
import AddToPptButton from "@/pages/share/_components/add-to-ppt-button.tsx";
import type { DemoReel } from "../_lib/demo-interactions.ts";

type Props = {
  reel: DemoReel;
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

/** One full-height demo scene — same phone-frame chrome as the researcher FeedSlide. */
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
  const progressBarRef = useRef<HTMLDivElement>(null);
  const playing = active && !paused;

  if (!mounted)
    return <div className="h-full w-full bg-black" aria-hidden />;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black contain-paint">
      <div className="relative h-full w-full overflow-hidden lg:aspect-[9/16] lg:w-auto lg:rounded-xl">
        <ReelCanvas
          reel={reel}
          playing={playing}
          stillAt={0.6}
          restartKey={active ? "on" : "off"}
          fit="cover"
          onEnded={onEnded}
          onProgress={(t, total) => {
            const bar = progressBarRef.current;
            if (bar) bar.style.width = `${total ? (t / total) * 100 : 0}%`;
          }}
          className="size-full"
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 pb-5 pt-24 text-white">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-semibold">{reel.title}</p>
            <div className="pointer-events-auto mt-2">
              <AddToPptButton reelId={reel.id} />
            </div>
          </div>
          <div className="pointer-events-auto shrink-0">
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
        <div className="absolute inset-x-0 bottom-0 z-30 h-1 bg-white/15">
          <div
            ref={progressBarRef}
            className="h-full bg-white"
            style={{ width: active ? undefined : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}
