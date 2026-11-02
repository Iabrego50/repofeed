import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import HelpHint from "@/components/help-hint.tsx";

interface Reel {
  _id: string;
  title: string;
  art?: {
    status: "pending" | "failed" | "completed";
    error?: string;
  };
  footage?: {
    url?: string;
    caption?: string;
    media?: string;
  } | null;
}

export function ArtBadge({ reel }: { reel: Reel }) {
  if (reel.art?.status === "pending") {
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
        <Loader2 className="size-3 animate-spin" /> Painting backdrop
      </span>
    );
  }
  if (reel.art?.status === "failed") {
    return (
      <span title={reel.art.error} className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[#FFC23D]">
        <AlertTriangle className="size-3" /> Backdrop failed
      </span>
    );
  }
  if (reel.footage?.media === "image") {
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
        <Sparkles className="size-3 text-primary" /> AI backdrop
      </span>
    );
  }
  return null;
}

export function PaintReelButton({ reel }: { reel: Reel }) {
  const paintMutation = useMutation({
    mutationFn: () => api.art.paintReel({ reelId: reel._id }),
    onSuccess: () => {
      toast.success("AI is creating a backdrop for this scene");
    },
    onError: (err: any) => {
      toast.error(err.message || "Couldn't start the backdrop");
    },
  });

  const pending = reel.art?.status === "pending" || paintMutation.isPending;
  const hasArt = reel.footage?.media === "image";

  return (
    <Button 
      variant="secondary" 
      className="col-span-2 h-11" 
      disabled={pending} 
      onClick={() => paintMutation.mutate()} 
      aria-label={`AI backdrop for ${reel.title}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
      {pending ? "Painting backdrop..." : hasArt ? "New AI backdrop" : reel.art?.status === "failed" ? "Try AI backdrop again" : "AI backdrop"}
    </Button>
  );
}

export function PaintStudyButton({ studyId }: { studyId: string }) {
  const paintMutation = useMutation({
    mutationFn: () => api.art.paintStudy({ studyId }),
    onSuccess: () => {
      toast.success("AI is creating backdrops for all scenes");
    },
    onError: (err: any) => {
      toast.error(err.message || "Couldn't start painting");
    },
  });

  return (
    <Button
      variant="secondary"
      size="lg"
      disabled={paintMutation.isPending}
      onClick={() => paintMutation.mutate()}
    >
      {paintMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
      {paintMutation.isPending ? "Painting..." : "AI backdrop all"}
      <HelpHint title="AI backdrop">Generate AI backdrops for every scene at once.</HelpHint>
    </Button>
  );
}
