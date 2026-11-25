import { Presentation } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "@/pages/feed/_lib/types.ts";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";
import { buildShareDeck } from "../_lib/build-share-deck.ts";
import { useRequiredDeckSelection } from "../_lib/deck-selection.ts";

/**
 * Builds a readout deck from insights added with Add to PPT.
 * Hidden until at least one insight is selected (keeps the stream clean).
 */
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
  variant?: "default" | "overlay" | "aside";
}) {
  const { selected, count } = useRequiredDeckSelection();
  if (count === 0) return null;

  const generate = () => {
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

  const label = `Generate PowerPoint (${count})`;

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={generate}
        aria-label={label}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white",
          className,
        )}
      >
        <Presentation className="size-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  const button = (
    <Button
      type="button"
      className={cn("h-11 w-full font-semibold", className)}
      onClick={generate}
      aria-label={label}
    >
      <Presentation className="size-4" />
      {label}
    </Button>
  );

  // Aside includes its own border so ReelFeed/demo don't leave an empty strip at N=0.
  if (variant === "aside") {
    return <div className="shrink-0 border-t border-border p-4">{button}</div>;
  }

  return button;
}
