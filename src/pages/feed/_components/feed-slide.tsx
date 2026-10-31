import { useEffect, useState } from "react";
import { useMutation } from '@/lib/convex-compat';
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Check, CircleQuestionMark, Download, Ellipsis, FileSearch, Link2, MessageCircle, Pause, Play, Type, Zap } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { ReactionKind } from "@/schema/validators.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.tsx";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import { reelScript } from "@/lib/reel/painter.ts";
import { errorMessage } from "@/lib/errors.ts";
import { SHAREABLE_ORIGIN } from "@/lib/site.ts";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "../_lib/types.ts";
import { useFeedMode } from "../_lib/feed-mode.ts";
import { GuestDismissed, useFeedActions } from "../_lib/use-feed-data.ts";
import type { PanelTab } from "./reel-panel.tsx";

const REACTIONS: Array<{ kind: ReactionKind; label: string; icon: typeof Check; count: keyof FeedReel["counts"] }> = [
  { kind: "true", label: "Rings true", icon: Check, count: "trueCount" },
  { kind: "surprised", label: "Surprised me", icon: Zap, count: "surprisedCount" },
  { kind: "pushback", label: "Push back", icon: CircleQuestionMark, count: "pushbackCount" },
];

function RailButton({
  label,
  count,
  active,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={active}
      aria-label={count !== undefined ? `${label}, ${count}` : label}
      className="group flex w-12 cursor-pointer flex-col items-center gap-0.5 focus-visible:outline-none sm:w-14 sm:gap-1"
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full bg-black/35 text-white sm:size-12 backdrop-blur-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring",
          active && "bg-primary text-primary-foreground",
        )}
      >
        {children}
      </span>
      <span className="font-mono text-[11px] font-bold text-white drop-shadow">{count ?? label}</span>
    </button>
  );
}

export default function FeedSlide({
  reel,
  active,
  isNew,
  onEnded,
  onOpenPanel,
  onExport,
}: {
  reel: FeedReel;
  active: boolean;
  isNew: boolean;
  onEnded: () => void;
  onOpenPanel: (tab: PanelTab) => void;
  onExport: () => void;
}) {
  const mode = useFeedMode();
  const { react: setReaction, recordView } = useFeedActions();
  const [paused, setPaused] = useState(false);
  const [showText, setShowText] = useState(false);
  const [restart, setRestart] = useState(0);
  const [wasActive, setWasActive] = useState(active);

  // Restart and un-pause whenever this reel becomes the visible one.
  if (active !== wasActive) {
    setWasActive(active);
    if (active) {
      setPaused(false);
      setRestart((n) => n + 1);
    }
  }

  // Record a view after 3 seconds on screen.
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => {
      void recordView(reel._id, false).catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [active, reel._id, recordView]);

  const react = async (kind: ReactionKind) => {
    try {
      await setReaction(reel._id, kind);
    } catch (err) {
      if (err instanceof GuestDismissed) return;
      toast.error(errorMessage(err, "Couldn't save your reaction"));
    }
  };

  const toggleSaveMutation = useMutation(api.feed.toggleSave);
  const toggleSave = async () => {
    try {
      const nowSaved = await toggleSaveMutation({ reelId: reel._id });
      toast.success(nowSaved ? "Saved to your list" : "Removed from Saved");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update your Saved list"));
    }
  };

  const getShareToken = useMutation(api.share.reelShareLink);

  /** Builds a public link that opens straight to this reel, with no sign-in. */
  const publicUrl = async (): Promise<string> => {
    const token = mode.kind === "share" ? mode.token : await getShareToken({ reelId: reel._id });
    return `${SHAREABLE_ORIGIN}/s/${token}?reel=${reel._id}`;
  };

  const copyLink = async () => {
    try {
      const url = publicUrl();
      // Passing the pending link to ClipboardItem keeps Safari's click permission across the await.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": url.then((u) => new Blob([u], { type: "text/plain" })) }),
        ]);
      } else {
        await navigator.clipboard.writeText(await url);
      }
      toast.success("Link copied. Anyone can open it, no sign-up needed.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't copy the link. Try again."));
    }
  };

  const playing = active && !paused && !showText;

  return (
    <section
      data-reel-id={reel._id}
      aria-roledescription="scene"
      aria-label={reel.title}
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black"
    >
      <div
        role="button"
        tabIndex={-1}
        aria-label={paused ? "Play" : "Pause"}
        className="absolute inset-0 cursor-pointer sm:right-20"
        onClick={() => setPaused((p) => !p)}
      >
        <ReelCanvas
          reel={reel}
          playing={playing}
          restartKey={restart}
          fit="cover"
          className="h-full w-full"
          onEnded={() => {
            void recordView(reel._id, true).catch(() => undefined);
            onEnded();
          }}
        />
      </div>

      <AnimatePresence>
        {paused && active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 grid place-items-center sm:right-20"
          >
            <span className="grid size-20 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
              <Play className="size-9 translate-x-0.5" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {showText && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-black/90 px-6 pb-40 pt-24 text-white">
          <p className="font-mono text-xs uppercase tracking-widest text-white/60">{reel.track}</p>
          <h2 className="mt-2 font-display text-2xl font-bold">{reel.title}</h2>
          <p className="mt-4 max-w-prose text-lg leading-relaxed">{reelScript(reel.scenes)}</p>
        </div>
      )}

      {/* Phones: one compact row along the bottom so nothing covers the insight. Larger screens: TikTok-style side rail. */}
      <div className="absolute inset-x-3 bottom-3 z-20 flex flex-row items-end gap-3 sm:inset-x-auto sm:bottom-6 sm:right-3 sm:flex-col sm:items-center">
        {REACTIONS.map((r) => (
          <RailButton key={r.kind} label={r.label} count={reel.counts[r.count]} active={reel.myReaction === r.kind} onClick={() => void react(r.kind)}>
            <r.icon className="size-[18px] sm:size-5" strokeWidth={2.5} />
          </RailButton>
        ))}
        <RailButton label="Discussion" count={reel.counts.commentCount} onClick={() => onOpenPanel("discussion")}>
          <MessageCircle className="size-[18px] sm:size-5" />
        </RailButton>
        {mode.kind === "member" && (
          <RailButton label={reel.saved ? "Saved" : "Save"} active={reel.saved} onClick={() => void toggleSave()}>
            <Bookmark className={cn("size-[18px] sm:size-5", reel.saved && "fill-current")} />
          </RailButton>
        )}
        <div className="hidden flex-col items-center gap-3 sm:flex">
          <RailButton label="Evidence" onClick={() => onOpenPanel("evidence")}>
            <FileSearch className="size-5" />
          </RailButton>
          <RailButton label="Link" onClick={() => void copyLink()}>
            <Link2 className="size-5" />
          </RailButton>
          <RailButton label="Export" onClick={onExport}>
            <Download className="size-5" />
          </RailButton>
        </div>
        <div className="ml-auto pb-[18px] sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label="More actions"
                className="grid size-10 cursor-pointer place-items-center rounded-full bg-black/35 text-white backdrop-blur-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Ellipsis className="size-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="min-w-44">
              <DropdownMenuItem className="cursor-pointer" onSelect={() => onOpenPanel("evidence")}>
                <FileSearch /> Evidence
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => void copyLink()}>
                <Link2 /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={onExport}>
                <Download /> Export video
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setShowText((v) => !v)}>
                <Type /> {showText ? "Back to video" : "Read as text"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tablets and up keep the rail in its own column beside the scene, so it never covers the text. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-[4.75rem] pt-16 sm:right-20 sm:pb-6 sm:pt-20">
        <div>
          {/* The scene already shows its track and study at the top, so only the title and sources sit here. */}
          <p className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-white sm:text-xl">
            {isNew && (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">New</span>
            )}
            <span className="min-w-0">{reel.title}</span>
          </p>
          <p className="mt-1 hidden truncate font-mono text-xs text-white/60 sm:block">{reel.sourceNames.join(", ")}</p>
        </div>
      </div>

      <div className="absolute left-3 top-3 z-20 flex gap-2">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="hidden size-11 cursor-pointer place-items-center rounded-full bg-black/40 text-white backdrop-blur focus-visible:outline-2 focus-visible:outline-ring sm:grid"
          aria-label={paused ? "Play scene" : "Pause scene"}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setShowText((v) => !v)}
          aria-pressed={showText}
          className={cn(
            "sr-only flex h-11 cursor-pointer items-center gap-2 rounded-full bg-black/40 px-4 text-sm text-white backdrop-blur focus:not-sr-only focus-visible:outline-2 focus-visible:outline-ring",
            showText && "not-sr-only",
          )}
        >
          <Type className="size-4" /> {showText ? "Back to video" : "Read as text"}
        </button>
      </div>
    </section>
  );
}
