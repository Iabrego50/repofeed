import { CheckCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/** Final snap slot after the last scene, so viewers know there's nothing left to watch. */
export default function CaughtUp({ total, watchedNew, onRestart }: { total: number; watchedNew: number; onRestart: () => void }) {
  return (
    <section
      aria-label="All caught up"
      className="flex h-full w-full snap-start flex-col items-center justify-center gap-5 bg-studio px-8 text-center text-white"
    >
      <span className="grid size-16 place-items-center rounded-full bg-mark text-mark-foreground">
        <CheckCheck className="size-8" strokeWidth={2.5} />
      </span>
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">End of feed</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">All caught up</h2>
        <p className="mt-2 max-w-xs text-sm text-white/65">
          {watchedNew > 0 && watchedNew < total
            ? `That's all ${total} scenes, including ${watchedNew} new. New scenes will show up first next time.`
            : `That's all ${total} scene${total === 1 ? "" : "s"}. New scenes will show up first when they're published.`}
        </p>
      </div>
      <Button variant="secondary" className="h-11 font-semibold" onClick={onRestart}>
        <RotateCcw className="size-4" /> Watch from the start
      </Button>
    </section>
  );
}
