import { Check, Presentation } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useDeckSelection } from "../_lib/deck-selection.ts";

/** Per-insight toggle to queue a scene for the PowerPoint deck. Hidden outside DeckSelectionProvider. */
export default function AddToPptButton({
  reelId,
  className,
}: {
  reelId: string;
  className?: string;
}) {
  const deck = useDeckSelection();
  if (!deck) return null;

  const added = deck.isSelected(reelId);

  return (
    <button
      type="button"
      aria-pressed={added}
      aria-label={added ? "Remove from PowerPoint" : "Add to PPT"}
      onClick={() => deck.toggle(reelId)}
      className={cn(
        "pointer-events-auto flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold backdrop-blur transition-colors focus-visible:outline-2 focus-visible:outline-white",
        added
          ? "border-transparent bg-white text-black"
          : "border-white/25 bg-black/40 text-white hover:bg-black/60",
        className,
      )}
    >
      {added ? <Check className="size-3.5" /> : <Presentation className="size-3.5" />}
      {added ? "Added to PPT" : "Add to PPT"}
    </button>
  );
}
