import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Scene } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

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
          {scene.type === "cta" && <p className="text-xs text-muted-foreground">{scene.sub}</p>}
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
          {(scene.items || []).map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="h-11"
                aria-label={`Item ${i + 1}`}
                value={item}
                onChange={(e) => onChange({ ...scene, items: (scene.items || []).map((it, j) => (j === i ? e.target.value : it)) })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Remove item ${i + 1}`}
                disabled={(scene.items || []).length <= 2}
                onClick={() => onChange({ ...scene, items: (scene.items || []).filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {(scene.items || []).length < 5 && (
            <Button variant="ghost" className="h-10" onClick={() => onChange({ ...scene, items: [...(scene.items || []), ""] })}>
              <Plus className="size-4" /> Add item
            </Button>
          )}
        </div>
      );
    case "stat":
      return (
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <Label htmlFor={`${id}-number`}>Number</Label>
            <Input id={`${id}-number`} className="h-11" value={scene.number} onChange={(e) => onChange({ ...scene, number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-unit`}>Unit</Label>
            <Input id={`${id}-unit`} className="h-11" value={scene.unit} onChange={(e) => onChange({ ...scene, unit: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor={`${id}-subtitle`}>Subtitle</Label>
            <Input id={`${id}-subtitle`} className="h-11" value={scene.subtitle ?? ""} onChange={(e) => onChange({ ...scene, subtitle: e.target.value || undefined })} />
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          <Label htmlFor={`${id}-text`}>Quote</Label>
          <Textarea id={`${id}-text`} rows={3} value={scene.text} onChange={(e) => onChange({ ...scene, text: e.target.value })} />
          <Label htmlFor={`${id}-attribution`}>Attribution</Label>
          <Input id={`${id}-attribution`} className="h-11" value={scene.attribution} onChange={(e) => onChange({ ...scene, attribution: e.target.value })} />
        </div>
      );
  }
}

interface EditReelDialogProps {
  reel: { _id: string; title: string; scenes: Scene[]; topics?: string[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditReelDialog({ reel, open, onOpenChange }: EditReelDialogProps) {
  const queryClient = useQueryClient();
  const [scenes, setScenes] = useState<Scene[]>(reel.scenes);
  const [topicsText, setTopicsText] = useState((reel.topics ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.studies.updateReelScenes({ reelId: reel._id, scenes, topics: topicsText.split(",").map((t) => t.trim()).filter(Boolean) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "reviewReels"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Reel updated");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Your changes weren’t saved. Try again.");
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {reel.title}</DialogTitle>
          <DialogDescription>
            Modify the scenes in this reel. Changes will update the video immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="reel-topics">Topics</Label>
            <Input
              id="reel-topics"
              className="h-11"
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              placeholder="pricing, cancellation flow"
              aria-describedby="reel-topics-hint"
            />
            <p id="reel-topics-hint" className="text-xs text-muted-foreground">
              Separate with commas. Up to four, one to three words each. People browse and search Explore by these.
            </p>
          </div>
          {scenes.map((scene, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">
                  Scene {i + 1} · {TYPE_LABEL[scene.type]}
                </p>
                {scenes.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScenes(scenes.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                )}
              </div>
              <SceneFields
                scene={scene}
                onChange={(updated) => setScenes(scenes.map((s, j) => (j === i ? updated : s)))}
                id={`scene-${i}`}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
