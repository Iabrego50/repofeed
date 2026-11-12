import { CheckCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/** Final snap slot after the last scene, so viewers know there's nothing left to watch. */
export default function CaughtUp({ total, watchedNew, onRestart }: { total: number; watchedNew: number; onRestart: () => void }) {
  return (
    <section
      aria-label="All caught up"
      className="flex h-full w-full snap-start snap-always flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_center,rgba(47,155,255,0.18),transparent_65%)] px-8 text-center text-white"
    >
      <span className="grid size-16 place-items-center rounded-full bg-primary/15 text-primary">
        <CheckCheck className="size-8" strokeWidth={2.5} />
      </span>
      <div>
        <h2 className="text-3xl font-bold">All caught up</h2>
        <p className="mt-2 max-w-xs text-sm text-white/70">
          {watchedNew > 0 && watchedNew < total
            ? `That's all ${total} scenes, including ${watchedNew} new. New scenes will show up first next time.`
            : `That's all ${total} scene${total === 1 ? "" : "s"}. New scenes will show up first when they're published.`}
        </p>
      </div>
      <Button variant="secondary" className="h-11" onClick={onRestart}>
        <RotateCcw className="size-4" /> Watch from the start
      </Button>
    </section>
  );
}
