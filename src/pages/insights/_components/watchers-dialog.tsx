import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from "date-fns";
import { Check, CircleQuestionMark, Users, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { Audience } from "../_lib/columns.ts";

const REACTION = {
  true: { label: "Rings true", icon: Check, color: "#3FE0A0" },
  surprised: { label: "Surprised me", icon: Zap, color: "#FFC23D" },
  pushback: { label: "Push back", icon: CircleQuestionMark, color: "#FF5A5F" },
} as const;

type Props = {
  reel: { reelId: string; title: string } | null;
  audience: Audience;
  onClose: () => void;
};

/** Who watched one scene, with guests labelled. Only subscribes while open. */
export default function WatchersDialog({ reel, audience, onClose }: Props) {
  const { data: all } = useQuery({
    queryKey: ['insights', 'watchers', reel?.reelId],
    queryFn: () => api.insights.watchers({ reelId: reel!.reelId }),
    enabled: !!reel,
  });
  const list = all?.filter((w) => audience === "everyone" || (audience === "guests") === w.isGuest);

  return (
    <Dialog open={reel !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">Who watched</DialogTitle>
          <DialogDescription className="line-clamp-2">{reel?.title}</DialogDescription>
        </DialogHeader>
        {list === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Users /></EmptyMedia>
              <EmptyTitle>Nobody yet</EmptyTitle>
              <EmptyDescription>People show up here once they watch this scene for a few seconds.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-1.5">
            {list.map((w) => {
              const r = w.reaction ? REACTION[w.reaction] : null;
              return (
                <li key={w.key} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      <span className="truncate">{w.name}</span>
                      {w.isGuest && <Badge variant="secondary" className="shrink-0 text-[10px]">Guest</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {w.completed ? "Finished" : "Started"} · {formatDistanceToNow(new Date(w.lastViewedAt), { addSuffix: true })}
                    </p>
                  </div>
                  {r && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs" style={{ background: `${r.color}1f`, color: r.color }}>
                      <r.icon className="size-3" strokeWidth={2.5} /> {r.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
