import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { Bookmark, Heart, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import { cn } from "@/lib/utils.ts";

interface FeedSlideProps {
  reel: {
    _id: string;
    title: string;
    track: string;
    trackIndex: number;
    studyTitle: string;
    scenes: any[];
    footage: any[];
    saved?: boolean;
    reactions?: { heart: number };
    commentCount?: number;
  };
  onShowComments: () => void;
  onShowEvidence: () => void;
}

export default function FeedSlide({ reel, onShowComments, onShowEvidence }: FeedSlideProps) {
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
    onError: (err: any) => {
      toast.error(err.message || "Failed to save");
    },
  });

  const reactMutation = useMutation({
    mutationFn: () => api.feed.react({ reelId: reel._id, type: "heart" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to react");
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
            studyTitle: reel.studyTitle,
            scenes: reel.scenes,
            footage: reel.footage,
          }}
          playing={playing}
          onPlayingChange={setPlaying}
          className="size-full"
        />

        {/* Controls overlay */}
        <div className="absolute inset-0 flex items-end justify-end p-4">
          <div className="flex flex-col gap-4">
            <button
              onClick={() => reactMutation.mutate()}
              disabled={reactMutation.isPending}
              className="flex flex-col items-center gap-1 text-white"
            >
              {reactMutation.isPending ? (
                <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
                  <Heart className="size-6" />
                </div>
              )}
              {reel.reactions?.heart && (
                <span className="text-xs font-medium">{reel.reactions.heart}</span>
              )}
            </button>

            <button
              onClick={onShowComments}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
                <MessageCircle className="size-6" />
              </div>
              {reel.commentCount && reel.commentCount > 0 && (
                <span className="text-xs font-medium">{reel.commentCount}</span>
              )}
            </button>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex flex-col items-center gap-1 text-white"
            >
              {saveMutation.isPending ? (
                <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : (
                <div className={cn(
                  "flex size-12 items-center justify-center rounded-full transition-colors",
                  reel.saved ? "bg-primary text-primary-foreground" : "bg-black/50 hover:bg-black/70"
                )}>
                  <Bookmark className={cn("size-6", reel.saved && "fill-current")} />
                </div>
              )}
            </button>

            <button
              onClick={onShowEvidence}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
                <span className="text-xs font-bold">📄</span>
              </div>
              <span className="text-xs font-medium">Sources</span>
            </button>
          </div>
        </div>

        {/* Tap to pause/play */}
        <button
          onClick={() => setPlaying(!playing)}
          className="absolute inset-0 size-full"
          aria-label={playing ? "Pause" : "Play"}
        />
      </div>
    </div>
  );
}
