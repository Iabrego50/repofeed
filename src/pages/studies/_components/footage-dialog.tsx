// @ts-nocheck
import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { Check, Film, Trash2, Upload, VideoOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { errorMessage, toastError } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";

const MAX_MB = 60;
const MAX_CAPTION = 60;

type Selection = { kind: "upload"; clipId: Id<"footageClips"> } | { kind: "stock"; url: string };

type Tile = { key: string; url: string; label: string; selection: Selection; clipId?: Id<"footageClips"> };

function initialSelection(footage: Doc<"reels">["footage"]): Selection | null {
  if (!footage || footage.media === "image") return null;
  if (footage.clipId) return { kind: "upload", clipId: footage.clipId };
  return { kind: "stock", url: footage.url };
}

function ClipTile({ tile, selected, onSelect, onDelete }: { tile: Tile; selected: boolean; onSelect: () => void; onDelete?: () => void }) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Use ${tile.label}`}
        onMouseEnter={(e) => void e.currentTarget.querySelector("video")?.play().catch(() => undefined)}
        onMouseLeave={(e) => e.currentTarget.querySelector("video")?.pause()}
        className={cn(
          "group relative block aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-xl border-2 border-transparent bg-muted focus-visible:outline-2 focus-visible:outline-ring",
          selected && "border-primary",
        )}
      >
        <video src={`${tile.url}#t=0.5`} muted loop playsInline preload="metadata" className="size-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5 text-left font-mono text-[10px] font-bold uppercase tracking-wide text-white">
          {tile.label}
        </span>
        {selected && (
          <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${tile.label}`}
          className="absolute right-1.5 top-1.5 grid size-8 cursor-pointer place-items-center rounded-full bg-black/60 text-white hover:bg-destructive focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

export default function FootageDialog({ reel, open, onOpenChange }: { reel: Doc<"reels">; open: boolean; onOpenChange: (o: boolean) => void }) {
  const library = useQuery(api.footage.library, open ? { workspaceId: reel.workspaceId } : "skip");
  const generateUploadUrl = useAction(api.footage.generateUploadUrl);
  const saveUpload = useAction(api.footage.saveUpload);
  const removeUpload = useMutation(api.footage.removeUpload);
  const setReelFootage = useMutation(api.footage.setReelFootage);

  const [selection, setSelection] = useState<Selection | null>(() => initialSelection(reel.footage));
  const [caption, setCaption] = useState(reel.footage?.media === "image" ? "" : (reel.footage?.caption ?? ""));
  const [tab, setTab] = useState<"upload" | "stock">(reel.footage && !reel.footage.clipId ? "stock" : "upload");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"footageClips"> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("video/")) return toast.error("Pick a video file, like an MP4 or MOV.");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Clips must be ${MAX_MB} MB or smaller.`);
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl({ workspaceId: reel.workspaceId });
      const res = await fetch(postUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const name = file.name.replace(/\.[^.]+$/, "");
      const clipId = await saveUpload({ workspaceId: reel.workspaceId, storageId, name });
      // Select the new clip right away; its tile appears once the library query updates.
      setSelection({ kind: "upload", clipId });
      if (!caption) setCaption(name.slice(0, MAX_CAPTION));
      toast.success("Clip uploaded");
    } catch (err) {
      toastError(err, "Couldn't upload the clip. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const deleteClip = async (clipId: Id<"footageClips">) => {
    try {
      const { cleared } = await removeUpload({ clipId });
      if (selection?.kind === "upload" && selection.clipId === clipId) setSelection(null);
      toast.success(cleared ? `Clip deleted and removed from ${cleared} scene${cleared === 1 ? "" : "s"}` : "Clip deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the clip"));
    } finally {
      setConfirmDelete(null);
    }
  };

  const save = async (next: Selection | null) => {
    setSaving(true);
    try {
      await setReelFootage({
        reelId: reel._id,
        footage: next
          ? { caption, source: next.kind === "upload" ? { kind: "upload", clipId: next.clipId } : { kind: "stock", url: next.url } }
          : null,
      });
      toast.success(next ? "Footage updated" : "Footage removed");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the footage"));
    } finally {
      setSaving(false);
    }
  };

  const uploadTiles: Tile[] = (library?.uploads ?? []).map((c) => ({
    key: c._id,
    url: c.url,
    label: c.name,
    clipId: c._id,
    selection: { kind: "upload", clipId: c._id },
  }));
  const stockTiles: Tile[] = (library?.stock ?? []).map((c) => ({
    key: c.url,
    url: c.url,
    label: c.label,
    selection: { kind: "stock", url: c.url },
  }));
  const isSelected = (t: Tile) =>
    selection !== null &&
    (selection.kind === "upload" ? t.clipId === selection.clipId : t.selection.kind === "stock" && t.url === selection.url);
  const tiles = tab === "upload" ? uploadTiles : stockTiles;
  const pendingDelete = uploadTiles.find((t) => t.clipId === confirmDelete);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Scene footage</DialogTitle>
          <DialogDescription>Pick a clip to play behind &ldquo;{reel.title}&rdquo;. The text stays on top.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="footage-caption">REC caption</Label>
          <Input
            id="footage-caption"
            className="h-11 font-mono uppercase"
            placeholder="Home visit · P07 · Day 3"
            maxLength={MAX_CAPTION}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown in the camera-style label over the clip. Leave empty to show just REC.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v === "stock" ? "stock" : "upload")}>
            <TabsList>
              <TabsTrigger value="upload" className="cursor-pointer">Your clips</TabsTrigger>
              <TabsTrigger value="stock" className="cursor-pointer">Stock clips</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "upload" && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="video/*"
                className="sr-only"
                aria-label="Upload a clip"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <Button variant="secondary" className="h-10" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Spinner /> : <Upload className="size-4" />}
                {uploading ? "Uploading..." : "Upload clip"}
              </Button>
            </>
          )}
        </div>

        {pendingDelete && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>Delete &ldquo;{pendingDelete.label}&rdquo;? Any scene using it goes back to the plain background.</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" className="h-9" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" className="h-9" onClick={() => void deleteClip(confirmDelete!)}>Delete</Button>
            </div>
          </div>
        )}

        {library === undefined ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />)}
          </ul>
        ) : tiles.length === 0 ? (
          <Empty className="border border-dashed border-border py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Film /></EmptyMedia>
              <EmptyTitle>No clips yet</EmptyTitle>
              <EmptyDescription>Upload field recordings or screen recordings (MP4, MOV or WebM, up to {MAX_MB} MB). Everyone in the workspace can reuse them.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {tiles.map((t) => (
              <ClipTile
                key={t.key}
                tile={t}
                selected={isSelected(t)}
                onSelect={() => setSelection(t.selection)}
                onDelete={t.clipId ? () => setConfirmDelete(t.clipId ?? null) : undefined}
              />
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="h-11 text-muted-foreground" disabled={saving || !reel.footage} onClick={() => void save(null)}>
            <VideoOff className="size-4" /> Remove footage
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="h-11 font-semibold" disabled={saving || uploading || !selection} onClick={() => void save(selection)}>
              {saving && <Spinner />} Save footage
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
