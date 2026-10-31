// @ts-nocheck
import { useState } from "react";
import { useMutation } from '@/lib/convex-compat';
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Scene } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { errorMessage } from "@/lib/errors.ts";

const TYPE_LABEL: Record<Scene["type"], string> = {
  hook: "Hook",
  line: "Line",
  list: "List",
  stat: "Stat",
  quote: "Quote",
  cta: "Closing",
};

function SceneFields({ scene, onChange, id }: { scene: Scene; onChange: (s: Scene) => void; id: string }) {
  switch (scene.type) {
    case "hook":
    case "cta":
      return (
        <div className="space-y-2">
          <Label htmlFor={`${id}-text`}>Text</Label>
          <Input id={`${id}-text`} className="h-11" value={scene.text} onChange={(e) => onChange({ ...scene, text: e.target.value })} />
          {scene.type === "cta" && <p className="font-mono text-xs text-muted-foreground">{scene.sub}</p>}
        </div>
      );
    case "line":
      return (
        <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
          <div className="space-y-2">
            <Label htmlFor={`${id}-kicker`}>Kicker</Label>
            <Input id={`${id}-kicker`} className="h-11" value={scene.kicker ?? ""} onChange={(e) => onChange({ ...scene, kicker: e.target.value || undefined })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-text`}>Text</Label>
            <Input id={`${id}-text`} className="h-11" value={scene.text} onChange={(e) => onChange({ ...scene, text: e.target.value })} />
          </div>
        </div>
      );
    case "list":
      return (
        <div className="space-y-2">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input id={`${id}-title`} className="h-11" value={scene.title} onChange={(e) => onChange({ ...scene, title: e.target.value })} />
          <Label>Items</Label>
          {scene.items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="h-11"
                aria-label={`Item ${i + 1}`}
                value={item}
                onChange={(e) => onChange({ ...scene, items: scene.items.map((it, j) => (j === i ? e.target.value : it)) })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Remove item ${i + 1}`}
                disabled={scene.items.length <= 2}
                onClick={() => onChange({ ...scene, items: scene.items.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {scene.items.length < 5 && (
            <Button variant="ghost" className="h-10" onClick={() => onChange({ ...scene, items: [...scene.items, ""] })}>
              <Plus className="size-4" /> Add item
            </Button>
          )}
        </div>
      );
    case "stat":
      return (
        <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor={`${id}-num`}>Number</Label>
            <Input id={`${id}-num`} className="h-11 font-mono" value={scene.num} onChange={(e) => onChange({ ...scene, num: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-label`}>Label</Label>
            <Input id={`${id}-label`} className="h-11" value={scene.label} onChange={(e) => onChange({ ...scene, label: e.target.value })} />
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          <Label htmlFor={`${id}-text`}>Quote (must match the source word-for-word)</Label>
          <Textarea id={`${id}-text`} rows={3} value={scene.text} onChange={(e) => onChange({ ...scene, text: e.target.value })} />
          <Label htmlFor={`${id}-by`}>Speaker role</Label>
          <Input id={`${id}-by`} className="h-11" value={scene.by} onChange={(e) => onChange({ ...scene, by: e.target.value })} />
        </div>
      );
  }
}

export default function EditReelDialog({ reel, open, onOpenChange }: { reel: Doc<"reels">; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useMutation(api.studies.updateReelScenes);
  const [title, setTitle] = useState(reel.title);
  const [scenes, setScenes] = useState<Scene[]>(reel.scenes);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { warning } = await update({ reelId: reel._id, title, scenes });
      if (warning) toast.warning(`Saved, but flagged: ${warning}. The scene is now excluded.`);
      else toast.success("Saved. Every quote and number checks out.");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the scene"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Edit scene</DialogTitle>
          <DialogDescription>Saving re-checks every quote and number against your sources.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reel-title">Title</Label>
            <Input id="reel-title" className="h-11" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Wrap a word in *asterisks* to highlight it in the accent color.</p>
          {scenes.map((s, i) => (
            <fieldset key={i} className="rounded-xl border border-border p-4">
              <legend className="px-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {i + 1} · {TYPE_LABEL[s.type]}
              </legend>
              <SceneFields id={`scene-${i}`} scene={s} onChange={(next) => setScenes((l) => l.map((x, j) => (j === i ? next : x)))} />
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-11 font-semibold" onClick={() => void save()} disabled={saving}>
            {saving && <Spinner />} Save and verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
