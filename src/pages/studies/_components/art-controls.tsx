// @ts-nocheck
import { useState } from "react";
import { useAction } from '@/lib/convex-compat';
import { toast } from "sonner";
import { AlertTriangle, Sparkles, Wand2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toastError } from "@/lib/errors.ts";
import HelpHint from "@/components/help-hint.tsx";

/** Overlay on a reel thumbnail: painting progress, failure, or the AI scene badge. */
export function ArtBadge({ reel }: { reel: Doc<"reels"> }) {
  if (reel.art?.status === "pending") {
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
        <Spinner className="size-3" /> Painting backdrop
      </span>
    );
  }
  if (reel.art?.status === "failed") {
    return (
      <span title={reel.art.error} className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[#FFC23D]">
        <AlertTriangle className="size-3" /> Backdrop failed
      </span>
    );
  }
  if (reel.footage?.media === "image") {
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
        <Sparkles className="size-3 text-primary" /> AI backdrop
      </span>
    );
  }
  return null;
}

/** Card action: ask Claude to art-direct (or redo) the scene behind one reel. */
export function PaintReelButton({ reel }: { reel: Doc<"reels"> }) {
  const paint = useAction(api.art.paintReel);
  const [starting, setStarting] = useState(false);
  const pending = reel.art?.status === "pending" || starting;
  const hasArt = reel.footage?.media === "image";
  const run = async () => {
    setStarting(true);
    try {
      await paint({ reelId: reel._id });
      toast.success("AI is creating a backdrop for this scene");
    } catch (err) {
      toastError(err, "Couldn't start the backdrop");
    } finally {
      setStarting(false);
    }
  };
  return (
    <Button variant="secondary" className="col-span-2 h-11" disabled={pending} onClick={() => void run()} aria-label={`AI backdrop for ${reel.title}`}>
      {pending ? <Spinner /> : <Wand2 className="size-4" />}
      {pending ? "Painting backdrop..." : hasArt ? "New AI backdrop" : reel.art?.status === "failed" ? "Try AI backdrop again" : "AI backdrop"}
    </Button>
  );
}

/** Study action: give every reel without its own footage an AI scene. */
export function PaintStudyButton({ studyId, reels }: { studyId: Id<"studies">; reels: Doc<"reels">[] }) {
  const paint = useAction(api.art.paintStudy);
  const [busy, setBusy] = useState(false);
  const pending = reels.filter((r) => r.art?.status === "pending").length;
  const todo = reels.filter((r) => r.art?.status !== "pending" && !r.footage?.clipId && r.footage?.media !== "image").length;
  if (!pending && !todo) return null;
  const run = async () => {
    setBusy(true);
    try {
      const n = await paint({ studyId });
      toast.success(`Creating ${n} backdrop${n === 1 ? "" : "s"}. They appear as each one is ready.`);
    } catch (err) {
      toastError(err, "Couldn't start the backdrops");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-1 font-display text-lg font-bold">{pending ? `Painting ${pending} backdrop${pending === 1 ? "" : "s"}…` : "Give every scene its own backdrop"}
          <HelpHint title="AI backdrops" article="footage-backdrops">
            AI paints an image that fits each scene's finding. Scenes that use your own uploaded clips are left alone. You can also pick footage per scene with the Footage button.
          </HelpHint>
        </p>
        <p className="text-sm text-muted-foreground">
          {pending
            ? "AI picks a moment that fits each insight and paints it. Scenes keep their stock clip until it's ready."
            : `${todo} scene${todo === 1 ? " uses" : "s use"} a stock clip. AI can paint a matching backdrop for each.`}
        </p>
      </div>
      {todo > 0 && (
        <Button className="h-11 font-semibold" disabled={busy} onClick={() => void run()}>
          {busy ? <Spinner /> : <Wand2 className="size-4" />} Create AI backdrops
        </Button>
      )}
    </div>
  );
}
