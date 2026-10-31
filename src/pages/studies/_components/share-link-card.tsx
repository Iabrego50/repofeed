import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { Copy, Link2, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SHAREABLE_ORIGIN } from "@/lib/site.ts";

interface ShareLinkCardProps {
  studyId: string;
}

export default function ShareLinkCard({ studyId }: ShareLinkCardProps) {
  const queryClient = useQueryClient();
  const { data: shareLink, isLoading } = useQuery({
    queryKey: ["studies", "shareLink", studyId],
    queryFn: () => api.studies.getShareLink({ studyId }),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.studies.setShareEnabled({ studyId, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "shareLink", studyId] });
      toast.success(shareLink?.enabled ? "Share link disabled" : "Share link enabled");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to toggle share link");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.studies.regenerateShareLink({ studyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "shareLink", studyId] });
      toast.success("Share link regenerated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to regenerate link");
    },
  });

  const [copying, setCopying] = useState(false);

  const copyLink = async () => {
    if (!shareLink?.token) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(`${SHAREABLE_ORIGIN}/share/${shareLink.token}`);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    } finally {
      setCopying(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  if (!shareLink) return null;

  const shareUrl = shareLink.enabled && shareLink.token 
    ? `${SHAREABLE_ORIGIN}/share/${shareLink.token}` 
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold">Share link</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone with the link can watch your published scenes
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <Switch
            checked={shareLink.enabled}
            onCheckedChange={(v) => toggleMutation.mutate(v)}
            disabled={toggleMutation.isPending}
          />
          <span className="text-sm">{shareLink.enabled ? "On" : "Off"}</span>
        </label>
      </div>

      {shareUrl && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="h-11 flex-1 rounded-lg border border-border bg-muted px-3 font-mono text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            onClick={copyLink}
            disabled={copying}
            variant="secondary"
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            {copying ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
          </Button>
        </div>
      )}

      {shareLink.enabled && (
        <Button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          variant="ghost"
          size="sm"
          className="mt-3"
        >
          {regenerateMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <Link2Off className="size-4" />
              Regenerate link
            </>
          )}
        </Button>
      )}
    </div>
  );
}
