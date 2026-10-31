import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Film, Maximize2, Pencil, Send, Undo2, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import { trackColor } from "@/lib/reel/constants.ts";
import { reelScript } from "@/lib/reel/painter.ts";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";
import EditReelDialog from "./edit-reel-dialog.tsx";
import FootageDialog from "./footage-dialog.tsx";
import ShareLinkCard from "./share-link-card.tsx";
import { ArtBadge, PaintReelButton, PaintStudyButton } from "./art-controls.tsx";
import HelpHint from "@/components/help-hint.tsx";

function ReelCard({ reel, studyTitle, onPreview }: { reel: Doc<"reels">; studyTitle: string; onPreview: () => void }) {
  const setEnabled = useMutation(api.studies.setReelEnabled);
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
              onCheckedChange={(v) => void setEnabled({ reelId: reel._id, enabled: v })}
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

export default function ReviewStep({ study }: { study: Doc<"studies"> }) {
  const reels = useQuery(api.studies.reviewReels, { studyId: study._id });
  const setPublished = useMutation(api.studies.setPublished);
  const [preview, setPreview] = useState<Doc<"reels"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  if (reels === undefined) {
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[9/20] w-full rounded-2xl" />)}
      </ul>
    );
  }

  const included = reels.filter((r) => r.enabled).length;
  const flagged = reels.filter((r) => r.warning).length;
  const published = study.status === "published";
  const showFlagged = onlyFlagged && flagged > 0;
  const visible = showFlagged ? reels.filter((r) => r.warning) : reels;

  const togglePublish = async () => {
    setBusy(true);
    try {
      await setPublished({ studyId: study._id, published: !published });
      toast.success(published ? "Unpublished. It's hidden from the feed." : "Published to the workspace feed");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the study"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-bold">
            {included} of {reels.length} scenes included
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {flagged ? `${flagged} flagged by verification and excluded until fixed.` : "Every quote and number matches your sources."}
            {flagged > 0 && (
              <HelpHint title="Flagged by verification" article="flagged-scenes">
                A quote or number in the scene couldn't be matched to your files, so it's left out of the feed. Edit the wording to match, or turn on Included to use it anyway.
              </HelpHint>
            )}
          </p>
        </div>
        <Button size="lg" className="h-12 font-semibold" variant={published ? "secondary" : "default"} onClick={() => void togglePublish()} disabled={busy || (!published && included === 0)}>
          {busy ? <Spinner /> : published ? <Undo2 className="size-4" /> : <Send className="size-4" />}
          {published ? "Unpublish" : "Publish to feed"}
        </Button>
      </div>
      {published && <ShareLinkCard studyId={study._id} published={published} />}
      <PaintStudyButton studyId={study._id} reels={reels} />
      {flagged > 0 && (
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter scenes">
          {[
            { value: false, label: `All scenes (${reels.length})` },
            { value: true, label: `Flagged (${flagged})` },
          ].map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={showFlagged === f.value}
              onClick={() => setOnlyFlagged(f.value)}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                showFlagged === f.value && "border-transparent bg-foreground text-background hover:text-background",
              )}
            >
              {f.value && <AlertTriangle className={cn("size-3.5", showFlagged !== f.value && "text-[#FFC23D]")} />}
              {f.label}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((r) => (
          <ReelCard key={r._id} reel={r} studyTitle={study.title} onPreview={() => setPreview(r)} />
        ))}
      </ul>
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent showCloseButton={false} className="h-dvh max-w-none border-0 bg-black p-0 sm:max-w-none">
          <DialogTitle className="sr-only">{preview?.title ?? "Preview"}</DialogTitle>
          {preview && (
            <ReelCanvas
              reel={{ title: preview.title, track: preview.track, trackIndex: preview.trackIndex, studyTitle: study.title, scenes: preview.scenes, footage: preview.footage }}
              playing
              className="h-full w-full"
            />
          )}
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 grid size-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Close preview"
          >
            <X className="size-5" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
