import { useMemo, useState } from "react";
import { Download, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "@/pages/feed/_lib/types.ts";
import { buildShareDeck } from "../_lib/build-share-deck.ts";
import type { Deck } from "@/pages/insights/deck/_lib/deck.ts";

/** Lets a share-link viewer pick any subset of insights and open or download a readout deck. */
export default function DeckPicker({
  open,
  onOpenChange,
  studyTitle,
  reels,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyTitle: string;
  reels: FeedReel[];
  onPreview: (deck: Deck) => void;
}) {
  const ids = useMemo(() => reels.map((r) => r._id), [reels]);
  const idsKey = ids.join("|");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ids));
  const [selectionKey, setSelectionKey] = useState(idsKey);
  const [wasOpen, setWasOpen] = useState(open);
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);

  // Reset the selection when the dialog opens or the insight list changes.
  if (open && (!wasOpen || selectionKey !== idsKey)) {
    setWasOpen(true);
    setSelectionKey(idsKey);
    setSelected(new Set(ids));
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const selectedReels = reels.filter((r) => selected.has(r._id));
  const count = selectedReels.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ids));
  const clearAll = () => setSelected(new Set());

  const makeDeck = () =>
    buildShareDeck({
      studyTitle,
      reels: selectedReels.map((r) => ({
        id: r._id,
        title: r.title,
        track: r.track,
        scenes: r.scenes,
      })),
    });

  const preview = () => {
    if (count === 0) return;
    setBusy("preview");
    try {
      onPreview(makeDeck());
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (count === 0) return;
    setBusy("download");
    try {
      const { exportPptx } = await import("@/pages/insights/deck/_lib/export-pptx.ts");
      await exportPptx(makeDeck());
      onOpenChange(false);
    } catch {
      toast.error("Couldn't build the PowerPoint file. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="flex max-h-[min(90dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="space-y-1 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-xl">Make a PowerPoint</DialogTitle>
          <DialogDescription>
            Pick any insights from this study. Same readout layout researchers use.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
          <span className="font-medium tabular-nums text-foreground">
            {count} selected
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={selectAll}>
              All
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={clearAll}>
              None
            </Button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {reels.map((reel) => {
            const checked = selected.has(reel._id);
            return (
              <li key={reel._id}>
                <label
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60",
                    checked && "bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(reel._id)}
                    aria-label={`Include ${reel.title}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{reel.title}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="h-11 font-semibold"
            disabled={count === 0 || busy !== null}
            onClick={preview}
          >
            {busy === "preview" ? <Spinner /> : <Presentation className="size-4" />}
            Preview
          </Button>
          <Button
            type="button"
            className="h-11 font-semibold"
            disabled={count === 0 || busy !== null}
            onClick={() => void download()}
          >
            {busy === "download" ? <Spinner /> : <Download className="size-4" />}
            Download PowerPoint
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
