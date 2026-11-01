import { BarChart3, FileText, Lightbulb, Quote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { reelScript } from "@/lib/reel/painter.ts";
import type { FeedReel } from "../_lib/types.ts";
import { useReelEvidence } from "../_lib/use-feed-data.ts";

export default function Evidence({ reel }: { reel: FeedReel }) {
  const findings = useReelEvidence(reel._id || reel.id || '');
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
      <section>
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Findings</h3>
        <ul className="mt-3 space-y-3">
          {findings === undefined
            ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            : findings.map((f) => (
                <li key={f._id} className="rounded-xl border border-border bg-background p-3">
                  {f.type === "quote" ? (
                    <>
                      <Quote className="size-4 text-primary" />
                      <p className="mt-2 text-sm">“{f.text}”</p>
                      {f.speaker && <p className="mt-2 font-mono text-xs text-muted-foreground">— {f.speaker}</p>}
                    </>
                  ) : f.type === "stat" ? (
                    <>
                      <BarChart3 className="size-4 text-primary" />
                      <p className="mt-2 font-display text-2xl font-extrabold text-primary">{f.number ?? "—"}</p>
                      <p className="text-sm">{f.label ?? f.text}</p>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="size-4 text-primary" />
                      <p className="mt-2 text-sm">{f.text}</p>
                    </>
                  )}
                </li>
              ))}
        </ul>
      </section>
      <section>
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source files</h3>
        <ul className="mt-3 space-y-2">
          {reel.sourceNames.map((n) => (
            <li key={n} className="flex items-center gap-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="break-all">{n}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">On-screen script</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{reelScript(reel.scenes)}</p>
      </section>
    </div>
  );
}
