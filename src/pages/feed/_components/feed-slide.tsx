import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFeedMode } from "../_lib/feed-mode.ts";
import { GuestDismissed, useFeedActions } from "../_lib/use-feed-data.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleQuestionMark, Play, Zap } from "lucide-react";
import type { ReactionType } from "@/schema/validators.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { isNativePlatform } from "@/lib/native";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import { SHAREABLE_ORIGIN } from "@/lib/site.ts";
import { track } from "@/lib/analytics";
import type { FeedReel } from "../_lib/types";
import type { PanelTab } from "./reel-panel";
import SceneActions from "./scene-actions.tsx";

interface FeedSlideProps {
  reel: FeedReel;
  active: boolean;
  isNew: boolean;
  onEnded: () => void;
  onOpenPanel: (tab: PanelTab) => void;
  /** Members only — omit for share-link viewers. */
  onExport?: () => void;
}

/** The three ways to answer a finding. Insights counts each one per scene. */
const REACTIONS: Array<{ kind: ReactionType; label: string; icon: typeof Check; key: string }> = [
  { kind: "true", label: "Rings true", icon: Check, key: "1" },
  { kind: "surprised", label: "Surprised me", icon: Zap, key: "2" },
  { kind: "pushback", label: "Push back", icon: CircleQuestionMark, key: "3" },
];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
}

/**
 * One full-height scene. Plays as soon as it is in view, pauses on tap, and
 * answers the same keys people already use on video sites.
 */
export default function FeedSlide({ reel, active, isNew, onEnded, onOpenPanel }: FeedSlideProps) {
  const queryClient = useQueryClient();
  const { react: reactOnFeed } = useFeedActions();
  const mode = useFeedMode();
  const isShare = mode.kind === "share";
  // Guests and native (Explore scene feed) keep topic tags as plain text.
  const linkTopics = !isShare && !isNativePlatform();
  // Guests may react (share_react) and comment; save/export stay member-only.
  const canReact = true;
  const canSave = !isShare;
  const [paused, setPaused] = useState(false);
  // Progress bar width is updated via ref so the RAF loop does not re-render React every frame.
  const progressBarRef = useRef<HTMLDivElement>(null);
  const playing = active && !paused;

  const saveMutation = useMutation({
    mutationFn: () => (reel.saved ? api.feed.unsave({ reelId: reel._id }) : api.feed.save({ reelId: reel._id })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      track("save", { reelId: reel._id, workspaceId: reel.workspaceId, saved: !reel.saved });
      toast.success(reel.saved ? "Removed from Saved" : "Saved");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Couldn\u2019t save this scene. Try again.");
    },
  });

  // The server toggles: sending the same reaction again removes it.
  const [mine, setMine] = useState<ReactionType | null>(null);
  const reactMutation = useMutation({
    mutationFn: (kind: ReactionType) => reactOnFeed(reel._id, kind),
    onSuccess: (result, kind) => {
      // `null` means the server removed an existing reaction of the same kind.
      setMine(result === null ? null : kind);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      track("heart", { reelId: reel._id, workspaceId: reel.workspaceId, kind });
    },
    onError: (err: unknown) => {
      if (err instanceof GuestDismissed) return;
      toast.error(err instanceof Error ? err.message : "Couldn\u2019t add your reaction. Try again.");
    },
  });

  const share = async () => {
    const url = isShare
      ? `${SHAREABLE_ORIGIN}/share/${mode.token}?reel=${reel._id}`
      : `${SHAREABLE_ORIGIN}/?reel=${reel._id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.message(url);
    }
  };

  const { mutate: react } = reactMutation;
  const { mutate: save } = saveMutation;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (key === "c") {
        onOpenPanel("discussion");
        return;
      }
      if (key === "e") {
        onOpenPanel("evidence");
        return;
      }
      if (canReact && key === "l") react("true");
      else if (canReact && (key === "1" || key === "2" || key === "3")) {
        react(REACTIONS[Number(key) - 1].kind);
      } else if (canSave && key === "s") save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, react, save, onOpenPanel, canReact, canSave]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black contain-paint">
      <div className="relative h-full w-full overflow-hidden lg:aspect-[9/16] lg:w-auto lg:rounded-xl">
        <ReelCanvas
          reel={{
            title: reel.title,
            track: reel.track,
            trackIndex: reel.trackIndex,
            studyTitle: reel.studyTitle || "",
            scenes: reel.scenes || [],
            footage: reel.footage,
          }}
          playing={playing}
          stillAt={0.6}
          restartKey={active ? "on" : "off"}
          fit="cover"
          onEnded={onEnded}
          onProgress={(t, total) => {
            const bar = progressBarRef.current;
            if (bar) bar.style.width = `${total ? (t / total) * 100 : 0}%`;
          }}
          className="size-full"
        />
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={playing ? "Pause scene" : "Play scene"}
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center"
        >
          {active && paused && (
            <span className="grid size-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
              <Play className="size-7 translate-x-0.5" />
            </span>
          )}
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 pb-5 pt-24 text-white">
          <div className="min-w-0 flex-1">
            {isNew && (
              <span className="mb-2 inline-block rounded-sm bg-mark px-1.5 py-0.5 text-[11px] font-bold text-mark-foreground">New</span>
            )}
            <p className="truncate text-[0.9375rem] font-semibold">{reel.title}</p>
            {(reel.topics?.length ?? 0) > 0 && (
              <div className="pointer-events-auto mt-1.5 flex flex-wrap gap-1">
                {reel.topics.slice(0, 3).map((topic) =>
                  linkTopics ? (
                    <Link
                      key={topic}
                      to={`/explore?topic=${encodeURIComponent(topic)}`}
                      aria-label={`More about ${topic}`}
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white/90 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                    >
                      #{topic.replace(/\s+/g, "")}
                    </Link>
                  ) : (
                    <span key={topic} className="px-1.5 py-0.5 text-[11px] font-semibold text-white/80">
                      #{topic.replace(/\s+/g, "")}
                    </span>
                  ),
                )}
              </div>
            )}
            {canReact && (
              <div role="group" aria-label="Your reaction" data-tour={active ? "reactions" : undefined} className="pointer-events-auto mt-3 flex flex-wrap gap-1.5">
                {REACTIONS.map((r) => (
                  <button
                    key={r.kind}
                    type="button"
                    aria-pressed={mine === r.kind}
                    disabled={reactMutation.isPending}
                    onClick={() => react(r.kind)}
                    title={`${r.label} (${r.key})`}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs font-semibold backdrop-blur transition-colors focus-visible:outline-2 focus-visible:outline-white",
                      mine === r.kind ? "border-transparent bg-white text-black" : "border-white/25 bg-black/40 text-white hover:bg-black/60",
                    )}
                  >
                    <r.icon className="size-3.5" /> {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pointer-events-auto" data-tour={active ? "scene-actions" : undefined}>
            <SceneActions
              hearted={mine === "true"}
              hearts={reel.reactions?.heart ?? 0}
              heartPending={reactMutation.isPending}
              onHeart={canReact ? () => react("true") : undefined}
              commentCount={reel.commentCount ?? 0}
              onComment={() => onOpenPanel("discussion")}
              saved={!!reel.saved}
              savePending={saveMutation.isPending}
              onSave={canSave ? () => save() : undefined}
              onEvidence={() => onOpenPanel("evidence")}
              onShare={() => void share()}
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-30 h-1 bg-white/15">
          <div
            ref={progressBarRef}
            className="h-full bg-white"
            style={{ width: active ? undefined : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}
