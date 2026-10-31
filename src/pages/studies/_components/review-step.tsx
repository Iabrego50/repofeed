import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { AlertTriangle, Film, Loader2, Maximize2, Pencil, Send } from "lucide-react";
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
import { ArtBadge, PaintReelButton, PaintStudyButton } from "./art-controls.tsx";
import HelpHint from "@/components/help-hint.tsx";

interface Reel {
  _id: string;
  title: string;
  track: string;
  trackIndex: number;
  scenes: any[];
  footage: any[];
  sourceNames: string[];
  enabled: boolean;
  warning?: string;
}

function ReelCard({ reel, studyTitle, onPreview }: { reel: Reel; studyTitle: string; onPreview: () => void }) {
  const queryClient = useQueryClient();
  const setEnabledMutation = useMutation({
    mutationFn: (enabled: boolean) => api.studies.setReelEnabled({ reelId: reel._id, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "reviewReels"] });
    },
  });

  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pickingFootage, setPickingFootage] = useState(false);
  const data = { title: reel.title, track: reel.track, trackIndex: reel.trackIndex, studyTitle, scenes: reel.scenes, footage: reel.footage };

  return (
    <li className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-opacity", reel.warning && "border-[#FFC23D]/60", !reel.enabled && "opacity-70")}>
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
        <ReelCanvas reel={data} playing={hover} stillAt={1.2} className="aspect-[9/16] w-full" />
        <ArtBadge reel={reel} />
        <span className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: trackColor(reel.trackIndex) }}>
          <span className="h-1 w-4 rounded-full" style={{ background: trackColor(reel.trackIndex) }} />
          <span className="truncate">{reel.track}</span>
        </p>
        <h3 className="font-display text-lg font-bold leading-tight">{reel.title}</h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">{reelScript(reel.scenes)}</p>
        <p className="truncate font-mono text-xs text-muted-foreground" title={reel.sourceNames.join(", ")}>
          {reel.sourceNames.join(", ")}
        </p>
        {reel.warning && (
          <div role="status" className="rounded-lg bg-[#FFC23D]/12 px-3 py-2 text-sm text-[#FFC23D]">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span className="min-w-0 break-words">{reel.warning}</span>
            </p>
            <p className="mt-1 pl-6 text-xs text-[#FFC23D]/80">Edit the scene to match your files, or include it anyway.</p>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={reel.enabled}
              onCheckedChange={(v) => setEnabledMutation.mutate(v)}
              aria-label={`Include ${reel.title}`}
            />
            {reel.enabled ? "Included" : "Excluded"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-11" onClick={() => setPickingFootage(true)} aria-label={`Footage for ${reel.title}`}>
              <Film className="size-4" /> Footage
            </Button>
            <Button variant="secondary" className="h-11" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <PaintReelButton reel={reel} />
          </div>
        </div>
      </div>
      {editing && <EditReelDialog reel={reel} open={editing} onOpenChange={setEditing} />}
      {pickingFootage && <FootageDialog reel={reel} open={pickingFootage} onOpenChange={setPickingFootage} />}
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

  const [preview, setPreview] = useState<Reel | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  if (reels === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[600px] w-full rounded-2xl" />)}
      </div>
    );
  }

  const flagged = reels.filter((r: Reel) => r.warning);
  const shown = onlyFlagged ? flagged : reels;
  const enabled = reels.filter((r: Reel) => r.enabled);
  const isPublished = study.status === "published";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Review & Publish</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {enabled.length} scene{enabled.length === 1 ? "" : "s"} ready to publish
              {flagged.length > 0 && ` (${flagged.length} flagged)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PaintStudyButton studyId={studyId} />
            <Button onClick={() => publishMutation.mutate()} disabled={busy || enabled.length === 0} size="lg">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isPublished ? "Update" : "Publish"}
            </Button>
          </div>
        </div>

        {flagged.length > 0 && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={onlyFlagged} onCheckedChange={setOnlyFlagged} />
            Show only flagged scenes ({flagged.length})
          </label>
        )}
      </div>

      {isPublished && <ShareLinkCard studyId={studyId} />}

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((reel: Reel) => (
          <ReelCard key={reel._id} reel={reel} studyTitle={study.title} onPreview={() => setPreview(reel)} />
        ))}
      </ul>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
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
