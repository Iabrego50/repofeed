import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { FeedReel } from "../_lib/types";
import type { PanelTab } from "./reel-panel";
import SceneActions from "./scene-actions.tsx";

interface FeedSlideProps {
  reel: FeedReel;
  active: boolean;
  isNew: boolean;
  onEnded: () => void;
  onOpenPanel: (tab: PanelTab) => void;
  onExport: () => void;
}

export default function FeedSlide({
  reel,
  active,
  onEnded,
  onOpenPanel,
}: FeedSlideProps) {
  const queryClient = useQueryClient();
  const [playing, setPlaying] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      reel.saved
        ? api.feed.unsave({ reelId: reel._id })
        : api.feed.save({ reelId: reel._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success(reel.saved ? "Removed from saved" : "Saved");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    },
  });

  const reactMutation = useMutation({
    mutationFn: () => api.feed.react({ reelId: reel._id, kind: "true" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to react");
    },
  });

  return (
    <div className="relative flex h-full items-center justify-center bg-black">
      <div className="relative aspect-[9/16] h-full max-h-screen">
        <ReelCanvas
          reel={{
            title: reel.title,
            track: reel.track,
            trackIndex: reel.trackIndex,
            studyTitle: reel.studyTitle || "",
            scenes: reel.scenes || [],
            footage: reel.footage,
          }}
          playing={active && playing}
          onEnded={() => {
            setPlaying(false);
            onEnded();
          }}
          className="size-full"
        />

        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="absolute inset-0 z-10 size-full"
          aria-label={playing ? "Pause" : "Play"}
        />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-end p-4">
          <div className="pointer-events-auto">
            <SceneActions
              hearts={reel.reactions?.heart ?? 0}
              heartPending={reactMutation.isPending}
              onHeart={() => reactMutation.mutate()}
              commentCount={reel.commentCount ?? 0}
              onComment={() => onOpenPanel("discussion")}
              saved={!!reel.saved}
              savePending={saveMutation.isPending}
              onSave={() => saveMutation.mutate()}
              onEvidence={() => onOpenPanel("evidence")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
