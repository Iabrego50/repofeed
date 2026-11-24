import { Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "@/pages/feed/_lib/types.ts";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import { buildShareDeck } from "../_lib/build-share-deck.ts";
import { useRequiredDeckSelection } from "../_lib/deck-selection.ts";

/** Builds a readout deck from insights the viewer added with Add to PPT. */
export default function GeneratePptButton({
  studyTitle,
  reels,
  onPreview,
  className,
  variant = "default",
}: {
  studyTitle: string;
  reels: FeedReel[];
  onPreview: (deck: Deck) => void;
  className?: string;
  variant?: "default" | "overlay";
}) {
  const { selected, count } = useRequiredDeckSelection();

  const generate = () => {
    if (count === 0) {
      toast.message("Tap Add to PPT on insights you want, then generate.");
      return;
    }
    // Keep feed order so the deck follows the study, not click order.
    const picked = reels.filter((r) => selected.has(r._id));
    onPreview(
      buildShareDeck({
        studyTitle,
        reels: picked.map((r) => ({
          id: r._id,
          title: r.title,
          track: r.track,
          scenes: r.scenes,
        })),
      }),
    );
  };

  const label = count > 0 ? `Generate PowerPoint (${count})` : "Generate PowerPoint";

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={generate}
        aria-label={label}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white",
          count === 0 && "opacity-80",
          className,
        )}
      >
        <Presentation className="size-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      className={cn("h-11 w-full font-semibold", className)}
      onClick={generate}
      aria-label={label}
      variant={count === 0 ? "secondary" : "default"}
    >
      <Presentation className="size-4" />
      {label}
    </Button>
  );
}
