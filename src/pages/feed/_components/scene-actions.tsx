import type { ReactNode } from "react";
import { Bookmark, FileSearch, Heart, Link2, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils.ts";

function ActionHint({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute right-full top-1/2 mr-3 w-max max-w-[10rem] -translate-y-1/2 rounded-full bg-mark px-3 py-1.5 text-right text-[11px] font-semibold leading-tight text-mark-foreground">
      {children}
    </span>
  );
}

/** Right-rail reactions matching the signed-in feed slide. */
export default function SceneActions({
  hearted = false,
  hearts = 0,
  heartPending = false,
  onHeart,
  commentCount = 0,
  onComment,
  saved = false,
  savePending = false,
  onSave,
  onEvidence,
  onShare,
  hints,
  onDismissHints,
}: {
  hearted?: boolean;
  hearts?: number;
  heartPending?: boolean;
  onHeart: () => void;
  commentCount?: number;
  onComment: () => void;
  saved?: boolean;
  savePending?: boolean;
  onSave: () => void;
  onEvidence: () => void;
  /** Copies a link that opens the feed on this scene. Omitted where there is nothing to link to. */
  onShare?: () => void;
  hints?: { react?: string; comment?: string; evidence?: string };
  onDismissHints?: () => void;
}) {
  const showHints = Boolean(hints?.react || hints?.comment || hints?.evidence);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => {
          onHeart();
          onDismissHints?.();
        }}
        disabled={heartPending}
        aria-label={hearted ? "Remove reaction" : "React"}
        aria-pressed={hearted}
        className="relative flex cursor-pointer flex-col items-center gap-1 text-white"
      >
        {hints?.react && <ActionHint>{hints.react}</ActionHint>}
        {heartPending ? (
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
            <Heart className={cn("size-6", hearted && "fill-[#ff5a6e] text-[#ff5a6e]")} />
          </div>
        )}
        {hearts > 0 && <span className="text-xs font-medium">{hearts}</span>}
      </button>

      <button
        type="button"
        onClick={() => {
          onComment();
          onDismissHints?.();
        }}
        aria-label="Open comments"
        className="relative flex cursor-pointer flex-col items-center gap-1 text-white"
      >
        {hints?.comment && <ActionHint>{hints.comment}</ActionHint>}
        <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
          <MessageCircle className="size-6" />
        </div>
        {commentCount > 0 && (
          <span className="text-xs font-medium">{commentCount}</span>
        )}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={savePending}
        aria-label={saved ? "Remove from saved" : "Save scene"}
        aria-pressed={saved}
        className="flex cursor-pointer flex-col items-center gap-1 text-white"
      >
        {savePending ? (
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full transition-colors",
              saved
                ? "bg-primary text-primary-foreground"
                : "bg-black/50 hover:bg-black/70",
            )}
          >
            <Bookmark className={cn("size-6", saved && "fill-current")} />
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          onEvidence();
          onDismissHints?.();
        }}
        aria-label="Open sources"
        className="relative flex cursor-pointer flex-col items-center gap-1 text-white"
      >
        {hints?.evidence && <ActionHint>{hints.evidence}</ActionHint>}
        <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
          <FileSearch className="size-6" />
        </div>
        <span className="text-xs font-medium">Sources</span>
      </button>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label="Copy link to this scene"
          className="flex cursor-pointer flex-col items-center gap-1 text-white"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70">
            <Link2 className="size-6" />
          </div>
          <span className="text-xs font-medium">Share</span>
        </button>
      )}

      {showHints && onDismissHints && (
        <button
          type="button"
          onClick={onDismissHints}
          className="min-h-8 cursor-pointer rounded-full bg-white/90 px-3 text-[11px] font-semibold text-black hover:bg-white"
        >
          Got it
        </button>
      )}
    </div>
  );
}
