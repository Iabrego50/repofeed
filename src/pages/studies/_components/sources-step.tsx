import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/hooks/use-workspace.ts";

interface Source {
  _id: string;
  name: string;
  size: number;
  uploadedAt: number;
}

interface SourcesStepProps {
  studyId: string;
  study: any;
  sources: Source[];
  onNext: () => void;
}

export default function SourcesStep({ studyId, study, sources, onNext }: SourcesStepProps) {
  const queryClient = useQueryClient();
  const { current } = useWorkspace();
  const [uploading, setUploading] = useState(false);

  const removeMutation = useMutation({
    mutationFn: (sourceId: string) => api.studies.removeSource({ sourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      toast.success("Source removed");
    },
    onError: (err: any) => {
      toast.error(err.message || "That file couldn’t be removed. Try again.");
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("studyId", studyId);

        await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      if (sources.length === 0) {
        track("first_upload", {
          workspaceId: current?._id,
          studyId,
          kind: "file",
        });
      }
      toast.success("Sources uploaded");
      e.target.value = "";
    } catch (err: any) {
      toast.error(err.message || "Those files didn’t go through. Check your connection and add them again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">
            {study?.title ? `${study.title} · first study` : "First study"}
          </p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight">Empty the drawer.</h3>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Drop in the interviews, surveys and decks from one study. Messy is fine. We’ll cut them into short insight scenes.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="study-name-display" className="font-semibold">
              Study name
            </Label>
            <Input
              id="study-name-display"
              readOnly
              value={study?.title ?? ""}
              className="h-11"
              placeholder="e.g. Q3 onboarding interviews"
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-dashed border-border bg-card p-6 shadow-lift">
          <Label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center justify-center rounded-xl px-4 py-10 text-center transition-colors hover:bg-muted/40">
              {uploading ? (
                <>
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <span className="mt-3 text-sm font-medium text-muted-foreground">Uploading…</span>
                </>
              ) : (
                <>
                  <Upload className="size-8 text-primary" />
                  <span className="mt-3 text-base font-bold">Drop research files here</span>
                  <span className="mt-4 inline-flex h-10 items-center rounded-full bg-studio px-5 text-sm font-semibold text-white">
                    Choose files
                  </span>
                  <span className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground">
                    docx · xlsx · pdf · md · pptx
                  </span>
                </>
              )}
            </div>
            <Input
              id="file-upload"
              type="file"
              multiple
              accept=".txt,.md,.pdf,.doc,.docx,.xlsx,.pptx"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </Label>
          <p className="mt-2 text-xs text-muted-foreground">
            {sources.length === 0 ? "Nothing here yet." : `${sources.length} file${sources.length === 1 ? "" : "s"} ready.`}
          </p>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-lg font-bold">Uploaded sources</h3>
          <ul className="mt-4 divide-y divide-border">
            {sources.map((source) => (
              <li key={source._id} className="flex items-center gap-3 py-3">
                <FileText className="size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(source.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(source._id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={onNext} size="lg">
            Continue to Details
          </Button>
        </div>
      )}
    </div>
  );
}
