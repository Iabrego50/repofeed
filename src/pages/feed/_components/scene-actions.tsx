import { Ear, Heart, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils.ts";

/**
 * Right-rail stream actions. The scene overlay only exposes Like, Comment,
 * and Heard this before — Add to PPT lives beside the title.
 */
export default function SceneActions({
  liked = false,
  likePending = false,
  onLike,
  commentCount = 0,
  onComment,
  heardBefore = false,
  heardPending = false,
  onHeardBefore,
}: {
  liked?: boolean;
  likePending?: boolean;
  onLike: () => void;
  commentCount?: number;
  onComment: () => void;
  heardBefore?: boolean;
  heardPending?: boolean;
  onHeardBefore: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4" role="group" aria-label="Scene actions">
      <button
        type="button"
        onClick={onLike}
        disabled={likePending}
        aria-label={liked ? "Unlike" : "Like"}
        aria-pressed={liked}
        className="relative flex min-h-11 min-w-11 cursor-pointer flex-col items-center gap-1 text-white"
      >
        {likePending ? (
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
            <Heart className={cn("size-6", liked && "fill-[#ff5a6e] text-[#ff5a6e]")} />
          </div>
        )}
        <span className="text-[10px] font-semibold">Like</span>
      </button>

      <button
        type="button"
        onClick={onComment}
        aria-label={commentCount > 0 ? `Open comments (${commentCount})` : "Open comments"}
        className="relative flex min-h-11 min-w-11 cursor-pointer flex-col items-center gap-1 text-white"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
          <MessageCircle className="size-6" />
        </div>
        <span className="text-[10px] font-semibold">Comment</span>
      </button>

      <button
        type="button"
        onClick={onHeardBefore}
        disabled={heardPending}
        aria-label={heardBefore ? "Remove heard this before" : "Heard this before"}
        aria-pressed={heardBefore}
        className="relative flex min-h-11 min-w-11 cursor-pointer flex-col items-center gap-1 text-white"
      >
        {heardPending ? (
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full transition-colors",
              heardBefore ? "bg-white text-black" : "bg-black/50 hover:bg-black/70",
            )}
          >
            <Ear className="size-6" />
          </div>
        )}
        <span className="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight">
          Heard this before
        </span>
      </button>
    </div>
  );
}
