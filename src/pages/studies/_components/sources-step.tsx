import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

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
  const [uploading, setUploading] = useState(false);

  const removeMutation = useMutation({
    mutationFn: (sourceId: string) => api.studies.removeSource({ sourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      toast.success("Source removed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove source");
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
      toast.success("Sources uploaded");
      e.target.value = "";
    } catch (err: any) {
      toast.error(err.message || "Failed to upload sources");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-bold">Upload sources</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload interviews, surveys, notes, or other research files. We'll extract findings from them.
        </p>

        <div className="mt-4">
          <Label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 transition-colors hover:border-primary hover:bg-muted/50">
              {uploading ? (
                <>
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm font-medium text-muted-foreground">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="size-5 text-muted-foreground" />
                  <span className="ml-2 text-sm font-medium">Click to upload files</span>
                </>
              )}
            </div>
            <Input
              id="file-upload"
              type="file"
              multiple
              accept=".txt,.md,.pdf,.doc,.docx"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </Label>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-bold">Uploaded sources</h3>
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
