import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import {
  AlertTriangle,
  Film,
  Loader2,
  Maximize2,
  Pencil,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import { trackColor } from "@/lib/reel/constants.ts";
import { reelScript } from "@/lib/reel/painter.ts";
import { cn } from "@/lib/utils.ts";
import EditReelDialog from "./edit-reel-dialog.tsx";
import FootageDialog from "./footage-dialog.tsx";
import ShareLinkCard from "./share-link-card.tsx";
import {
  ArtBadge,
  PaintReelButton,
  PaintStudyButton,
} from "./art-controls.tsx";
import HelpHint from "@/components/help-hint.tsx";
import DivisionAssign from "./division-assign.tsx";

interface ReviewReel {
  _id: string;
  title: string;
  track: string;
  trackIndex: number;
  scenes: any[];
  topics?: string[];
  footage?: { url: string; caption: string; media?: "image" | "video" } | null;
  video?: { status?: string; error?: string } | null;
  sourceNames: string[];
  enabled: boolean;
  warning?: string;
  art?: {
    status: "pending" | "failed" | "completed";
    error?: string;
  };
}

function ReelCard({
  reel,
  studyTitle,
  onPreview,
}: {
  reel: ReviewReel;
  studyTitle: string;
  onPreview: () => void;
}) {
  const queryClient = useQueryClient();
  const setEnabledMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.studies.setReelEnabled({ reelId: reel._id, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "reviewReels"] });
    },
  });

  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pickingFootage, setPickingFootage] = useState(false);
  const data = {
    title: reel.title,
    track: reel.track,
    trackIndex: reel.trackIndex,
    studyTitle,
    scenes: reel.scenes,
    footage: reel.footage,
  };

  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-[1.5rem] border border-studio/80 bg-studio text-white transition-opacity shadow-lift",
        reel.warning && "ring-2 ring-mark/60",
        !reel.enabled && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onPreview}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="group relative cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        aria-label={`Preview ${reel.title} full screen`}
      >
        <ReelCanvas
          reel={data}
          playing={hover}
          stillAt={1.2}
          className="aspect-[9/16] w-full"
        />
        <ArtBadge reel={reel} />
        <span className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">
          Scene {reel.trackIndex + 1}
        </p>
        <h3 className="font-serif text-lg font-semibold leading-snug text-white">
          {reel.title || reelScript(reel.scenes)}
        </h3>
        <p className="line-clamp-2 text-xs text-white/55" style={{ color: trackColor(reel.trackIndex) }}>
          {reel.track}
        </p>
        {reel.sourceNames.length > 0 && (
          <span
            className="w-fit rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/80"
            title={reel.sourceNames.join(", ")}
          >
            Cut from {reel.sourceNames[0]}
          </span>
        )}
        {reel.warning && (
          <div role="status" className="rounded-lg bg-mark/15 px-3 py-2 text-sm text-mark">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{reel.warning}</span>
            </p>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            type="button"
            aria-pressed={reel.enabled}
            aria-label={`${reel.enabled ? "Keeping" : "Cut"} ${reel.title}`}
            onClick={() => setEnabledMutation.mutate(!reel.enabled)}
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors",
              reel.enabled
                ? "bg-mark text-mark-foreground"
                : "bg-white/10 text-white/70 hover:bg-white/15",
            )}
          >
            {reel.enabled ? "Keeping. Tap to cut" : "Cut. Tap to keep"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-10 border-0 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setPickingFootage(true)}
              aria-label={`Footage for ${reel.title}`}
            >
              <Film className="size-4" /> Footage
            </Button>
            <Button
              variant="secondary"
              className="h-10 border-0 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <PaintReelButton reel={reel} />
          </div>
        </div>
      </div>
      {editing && (
        <EditReelDialog reel={reel} open={editing} onOpenChange={setEditing} />
      )}
      {pickingFootage && (
        <FootageDialog
          reel={reel}
          open={pickingFootage}
          onOpenChange={setPickingFootage}
        />
      )}
    </li>
  );
}

interface ReviewStepProps {
  studyId: string;
  study: any;
}

export default function ReviewStep({ studyId, study }: ReviewStepProps) {
  const queryClient = useQueryClient();
  const { data: reels } = useQuery({
    queryKey: ["studies", "reviewReels", studyId],
    queryFn: () => api.studies.reviewReels({ studyId }),
  });

  useEffect(() => {
    let cancelled = false;
    void api.videos
      .backfill({ studyId })
      .then(() => {
        if (!cancelled)
          queryClient.invalidateQueries({
            queryKey: ["studies", "reviewReels", studyId],
          });
      })
      .catch(() => undefined);
    const timer = window.setInterval(() => {
      void api.videos
        .process({ studyId })
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: ["studies", "reviewReels", studyId],
          });
        })
        .catch(() => undefined);
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [studyId, queryClient]);

  const publishMutation = useMutation({
    mutationFn: () => api.studies.publish({ studyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      toast.success("Study published!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Couldn't publish study");
    },
  });

  const [preview, setPreview] = useState<ReviewReel | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  if (reels === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[600px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const flagged = reels.filter((r: any) => r.warning);
  const shown = onlyFlagged ? flagged : reels;
  const enabled = reels.filter((r: any) => r.enabled);
  const isPublished = study.status === "published";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">
            {study?.title ?? "Sample study"} · first cut
          </p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight">You're the editor.</h3>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Keep the scenes worth your team's scroll. Cut the rest. Nothing airs without your say.
            {" "}
            {enabled.length} of {reels.length} scenes kept
            {flagged.length > 0 && ` · ${flagged.length} flagged`}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaintStudyButton studyId={studyId} />
          <Button
            onClick={() => publishMutation.mutate()}
            disabled={busy || enabled.length === 0}
            size="lg"
            className="font-semibold"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {isPublished ? "Update" : "Pick a channel"}
          </Button>
        </div>
      </div>

      {flagged.length > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={onlyFlagged} onCheckedChange={setOnlyFlagged} />
          Show only flagged scenes ({flagged.length})
        </label>
      )}

      {isPublished && <ShareLinkCard studyId={studyId} />}

      <DivisionAssign studyId={studyId} value={study.division ?? null} />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((reel: any) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            studyTitle={study.title}
            onPreview={() => setPreview(reel)}
          />
        ))}
      </ul>

      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="max-w-[min(90vw,calc(90vh*9/16))] p-0">
          <DialogTitle className="sr-only">{preview?.title}</DialogTitle>
          {preview && (
            <ReelCanvas
              reel={{ ...preview, studyTitle: study.title }}
              playing
              className="aspect-[9/16] w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
