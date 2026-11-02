import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { Check, Image as ImageIcon, Loader2, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

interface FootageDialogProps {
  reel: { _id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FootageDialog({ reel, open, onOpenChange }: FootageDialogProps) {
  const queryClient = useQueryClient();
  const { data: clips } = useQuery({
    queryKey: ["footage", "clips", reel._id],
    queryFn: () => api.footage.listClips({ reelId: reel._id }),
    enabled: open,
  });

  const selectMutation = useMutation({
    mutationFn: (clipId: string) => api.footage.selectClip({ reelId: reel._id, clipId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "reviewReels"] });
      queryClient.invalidateQueries({ queryKey: ["footage", "clips", reel._id] });
      toast.success("Footage selected");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to select footage");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("reelId", reel._id);
      
      const response = await fetch("/api/footage/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["footage", "clips", reel._id] });
      toast.success("Footage uploaded");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload footage");
    },
  });

  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Footage for {reel.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="footage-upload" className="cursor-pointer">
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 transition-colors hover:border-primary hover:bg-muted/50">
                {uploading ? (
                  <>
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm font-medium text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-5 text-muted-foreground" />
                    <span className="ml-2 text-sm font-medium">Upload video or image</span>
                  </>
                )}
              </div>
              <input
                id="footage-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {clips === undefined ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-lg" />
              ))}
            </div>
          ) : clips.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No footage uploaded yet. Upload a video or image to use as background.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {clips.map((clip: any) => (
                <button
                  key={clip._id}
                  type="button"
                  onClick={() => selectMutation.mutate(clip._id)}
                  disabled={selectMutation.isPending}
                  className={cn(
                    "group relative aspect-video overflow-hidden rounded-lg border-2 transition-all",
                    clip.selected
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {clip.type === "video" ? (
                    <video src={clip.url} className="size-full object-cover" muted />
                  ) : (
                    <img src={clip.url} alt={clip.name} className="size-full object-cover" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {clip.type === "video" ? (
                      <Video className="size-6 text-white" />
                    ) : (
                      <ImageIcon className="size-6 text-white" />
                    )}
                  </div>
                  {clip.selected && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary p-1">
                      <Check className="size-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
