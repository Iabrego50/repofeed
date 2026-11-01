import { X } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "../_lib/types.ts";
import Discussion from "./discussion.tsx";
import Evidence from "./evidence.tsx";

export type PanelTab = "discussion" | "evidence";

export default function ReelPanel({
  reel,
  tab,
  onTab,
  onClose,
  className,
}: {
  reel: FeedReel;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col bg-card", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 pt-2">
        <div role="tablist" aria-label="Scene details" className="flex flex-1 gap-1">
          {(["discussion", "evidence"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => onTab(t)}
              className={cn(
                "-mb-px min-h-11 cursor-pointer border-b-2 border-transparent px-3 text-sm font-semibold capitalize text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                tab === t && "border-primary text-foreground",
              )}
            >
              {t}
              {t === "discussion" && (reel.counts?.comments || reel.commentCount || 0) > 0 && (
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">{reel.counts?.comments || reel.commentCount || 0}</span>
              )}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Close panel"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <div className="border-b border-border px-4 py-3">
        <p className="truncate font-display font-bold">{reel.title}</p>
        <p className="truncate text-xs text-muted-foreground">{reel.track} · {reel.studyTitle}</p>
      </div>
      {tab === "discussion" ? <Discussion reelId={reel._id} /> : <Evidence reel={reel} />}
    </div>
  );
}
