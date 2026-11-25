import { useEffect, useRef, useState } from "react";
import { useFeedMode } from "../_lib/feed-mode.ts";
import { GuestDismissed, useFeedActions } from "../_lib/use-feed-data.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import type { ReactionType } from "@/schema/validators.ts";
import { toast } from "sonner";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import { track } from "@/lib/analytics";
import type { FeedReel } from "../_lib/types";
import type { PanelTab } from "./reel-panel";
import SceneActions from "./scene-actions.tsx";
import AddToPptButton from "@/pages/share/_components/add-to-ppt-button.tsx";

interface FeedSlideProps {
  reel: FeedReel;
  active: boolean;
  onEnded: () => void;
  onOpenPanel: (tab: PanelTab) => void;
  /** Members only — omit for share-link viewers. */
  onExport?: () => void;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
}

/**
 * One full-height scene. Stream overlay is limited to Add to PPT, Like,
 * Comment, and Heard this before — plus play/pause and the progress bar.
 */
export default function FeedSlide({ reel, active, onEnded, onOpenPanel }: FeedSlideProps) {
  const queryClient = useQueryClient();
  const { react: reactOnFeed } = useFeedActions();
  const [paused, setPaused] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const playing = active && !paused;

  // The server toggles: sending the same reaction again removes it.
  // Like → `true`; Heard this before → `surprised` (existing kinds; stream labels only).
  const [mine, setMine] = useState<ReactionType | null>(null);
  const reactMutation = useMutation({
    mutationFn: (kind: ReactionType) => reactOnFeed(reel._id, kind),
    onSuccess: (result, kind) => {
      setMine(result === null ? null : kind);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      track("heart", { reelId: reel._id, workspaceId: reel.workspaceId, kind });
    },
    onError: (err: unknown) => {
      if (err instanceof GuestDismissed) return;
      toast.error(err instanceof Error ? err.message : "Couldn\u2019t add your reaction. Try again.");
    },
  });

  const { mutate: react } = reactMutation;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (key === "c") {
        onOpenPanel("discussion");
        return;
      }
      if (key === "l") react("true");
      if (key === "h") react("surprised");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, react, onOpenPanel]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black contain-paint">
      <div className="relative h-full w-full overflow-hidden lg:aspect-[9/16] lg:w-auto lg:rounded-xl">
        <ReelCanvas
          reel={{
            title: reel.title,
            track: reel.track,
            trackIndex: reel.trackIndex,
            studyTitle: reel.studyTitle || "",
            scenes: reel.scenes || [],
            footage: reel.footage,
          }}
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
              <AddToPptButton reelId={reel._id} />
            </div>
          </div>
          <div className="pointer-events-auto" data-tour={active ? "scene-actions" : undefined}>
            <SceneActions
              liked={mine === "true"}
              likePending={reactMutation.isPending}
              onLike={() => react("true")}
              commentCount={reel.commentCount ?? 0}
              onComment={() => onOpenPanel("discussion")}
              heardBefore={mine === "surprised"}
              heardPending={reactMutation.isPending}
              onHeardBefore={() => react("surprised")}
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
