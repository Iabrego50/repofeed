import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  Bookmark,
  Check,
  CircleQuestionMark,
  Clapperboard,
  Download,
  Ellipsis,
  FileSearch,
  Hand,
  Link2,
  MessageCircle,
  Search,
  Sparkles,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";

type IconRow = { icon: LucideIcon; name: string; what: string; pill?: string };
type Step = { kicker: string; title: string; body: string; rows: IconRow[] };

const STEPS: Step[] = [
  {
    kicker: "Welcome",
    title: "Your research, as short scenes",
    body: "Each scene turns one finding from your research files into a short story, about 10 to 20 seconds long. Here is a quick tour of what everything on the feed does.",
    rows: [
      { icon: ArrowDown, name: "Swipe or scroll", what: "Move to the next scene. On a computer, the arrow keys or J and K work too." },
      { icon: Hand, name: "Tap the scene", what: "Pause and play. A scene moves on by itself when it ends." },
    ],
  },
  {
    kicker: "React",
    title: "Tell the team what you think",
    body: "Tap one reaction per scene. The number underneath shows how many people picked it, and editors see the totals in Insights.",
    rows: [
      { icon: Check, name: "Rings true", what: "This matches what you have seen yourself." },
      { icon: Zap, name: "Surprised me", what: "You didn't expect this. Great for spotting new learnings." },
      { icon: CircleQuestionMark, name: "Push back", what: "You doubt it or want more proof. Add a comment to say why." },
    ],
  },
  {
    kicker: "Dig in",
    title: "Talk about it and check the source",
    body: "On a computer these open in the panel on the right. On a phone they slide up from the bottom.",
    rows: [
      { icon: MessageCircle, name: "Discussion", what: "Comment and reply. The number shows how many comments there are." },
      { icon: FileSearch, name: "Evidence", what: "See the exact quotes and files the scene was built from." },
    ],
  },
  {
    kicker: "Share",
    title: "Pass a scene along",
    body: "On a phone, these live under the three-dot button at the bottom right.",
    rows: [
      { icon: Link2, name: "Link", what: "Copies a link anyone can open, no sign-up needed." },
      { icon: Download, name: "Export", what: "Download the scene as a video for slides or chat." },
      { icon: Type, name: "Read as text", what: "Read the scene as plain text instead of watching." },
      { icon: Ellipsis, name: "More", what: "On phones, opens Evidence, Link, Export and Read as text." },
    ],
  },
  {
    kicker: "Find it again",
    title: "Save scenes and search them all",
    body: "Keep the scenes that matter to you, and find any scene in seconds.",
    rows: [
      { icon: Bookmark, name: "Save", what: "Tap the bookmark to keep a scene. Open it later from the Saved chip at the top. Only you see your list." },
      { icon: Search, name: "Search", what: "Tap the magnifying glass at the top right, or press / on a computer, to search every scene." },
    ],
  },
  {
    kicker: "Stay current",
    title: "Never miss a new finding",
    body: "Scenes you haven't watched yet always come first, so you can pick up where you left off.",
    rows: [
      { icon: Sparkles, name: "New", what: "Marks scenes added since you last watched.", pill: "New" },
      { icon: Clapperboard, name: "Study filters", what: "The chips at the top show one study at a time." },
      { icon: Check, name: "All caught up", what: "The last card tells you you've seen everything, with a button to start over." },
    ],
  },
];

function IconBubble({ icon: Icon, pill }: { icon: LucideIcon; pill?: string }) {
  if (pill) {
    return (
      <span className="grid h-10 w-12 shrink-0 place-items-center">
        <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">{pill}</span>
      </span>
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/10">
      <Icon className="size-[18px]" strokeWidth={2.5} />
    </span>
  );
}

/** Step-by-step guide to the feed, shown on first sign-in and from the workspace menu. */
export default function FeedTour({ open, isEditor, onDone }: { open: boolean; isEditor: boolean; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = () => {
    onDone();
    setIndex(0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="relative bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_60%)] px-6 pb-4 pt-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
              {step.kicker} · {index + 1}/{STEPS.length}
            </p>
            <button type="button" onClick={finish} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Skip tour
            </button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <DialogTitle className="pt-3 font-display text-2xl font-bold leading-tight text-balance">{step.title}</DialogTitle>
              <DialogDescription className="pt-2 leading-relaxed">{step.body}</DialogDescription>
              <ul className="space-y-3 pt-5">
                {step.rows.map((r) => (
                  <li key={r.name} className="flex items-start gap-3">
                    <IconBubble icon={r.icon} pill={r.pill} />
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.what}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.kicker} className={cn("h-1.5 rounded-full bg-border transition-all", i === index ? "w-5 bg-primary" : "w-1.5")} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            )}
            {!isLast ? (
              <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
            ) : isEditor ? (
              <>
                <Button variant="secondary" onClick={finish}>Watch the feed</Button>
                <Button asChild onClick={finish}>
                  <Link to="/studies/new">Create a study</Link>
                </Button>
              </>
            ) : (
              <Button onClick={finish}>Start watching</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
