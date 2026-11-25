import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  Ear,
  Hand,
  Heart,
  MessageCircle,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";

type IconRow = { icon: LucideIcon; name: string; what: string };
type Step = { kicker: string; title: string; body: string; rows: IconRow[] };

const STEPS: Step[] = [
  {
    kicker: "Welcome",
    title: "Your research, as short scenes",
    body: "Each scene turns one finding into a short story. Here’s what you can do on the feed.",
    rows: [
      { icon: ArrowDown, name: "Swipe or scroll", what: "Move to the next scene. On a computer, the arrow keys or J and K work too." },
      { icon: Hand, name: "Tap the scene", what: "Pause and play. A scene moves on by itself when it ends." },
    ],
  },
  {
    kicker: "Respond",
    title: "Four actions on every scene",
    body: "The stream stays clean — only these controls sit on each insight.",
    rows: [
      { icon: Heart, name: "Like", what: "Mark a finding you agree with." },
      { icon: MessageCircle, name: "Comment", what: "Ask a question or leave a note for the team." },
      { icon: Ear, name: "Heard this before", what: "Flag a finding you’ve already seen in the field." },
      { icon: Presentation, name: "Add to PPT", what: "Queue the insight, then generate a PowerPoint when you’re ready." },
    ],
  },
];

type Props = {
  open: boolean;
  isEditor: boolean;
  onDone: () => void;
};

export default function FeedTour({ open, isEditor, onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const last = step >= STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="border-b border-border px-5 py-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {current.kicker}
          </p>
          <DialogTitle className="mt-1 text-xl font-bold tracking-tight">{current.title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
            {current.body}
          </DialogDescription>
        </div>
        <ul className="space-y-3 px-5 py-4">
          <AnimatePresence mode="wait">
            {current.rows.map((row) => (
              <motion.li
                key={row.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
                  <row.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{row.name}</span>
                  <span className="block text-sm text-muted-foreground">{row.what}</span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn("size-1.5 rounded-full", i === step ? "bg-primary" : "bg-border")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!last ? (
              <Button type="button" className="h-10" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button type="button" className="h-10" onClick={onDone}>
                Got it
              </Button>
            )}
          </div>
        </div>
        {isEditor && last && (
          <p className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
            Ready to publish?{" "}
            <Link to="/studies/new" className="font-semibold text-foreground underline-offset-2 hover:underline">
              Create a study
            </Link>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
