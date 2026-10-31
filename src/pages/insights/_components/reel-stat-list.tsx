import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, CircleQuestionMark, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select.tsx";
import { COLUMNS, pct, type DashboardRow, type Sort } from "../_lib/columns.ts";

type Props<R extends DashboardRow> = {
  rows: R[];
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  showStudy: boolean;
  reelHref: (reelId: string) => string;
  onShowWatchers?: (row: R) => void;
};

/** Phone-sized replacement for the reel table: one card per reel with a sort picker. */
export default function ReelStatList<R extends DashboardRow>({ rows, sort, onSortChange, showStudy, reelHref, onShowWatchers }: Props<R>) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-display text-lg font-bold">All scenes</h2>
        <label htmlFor="reel-sort" className="sr-only">Sort by</label>
        <NativeSelect
          id="reel-sort"
          className="h-10 w-40"
          value={sort.key}
          onChange={(e) => {
            const col = COLUMNS.find((c) => c.key === e.target.value);
            if (col) onSortChange({ key: col.key, dir: col.numeric ? -1 : 1 });
          }}
        >
          {COLUMNS.map((c) => (
            <NativeSelectOption key={c.key} value={c.key}>{c.key === "title" ? "Name" : c.label}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          variant="secondary"
          size="icon"
          className="size-10"
          aria-label={sort.dir === 1 ? "Sorted ascending" : "Sorted descending"}
          onClick={() => onSortChange({ ...sort, dir: sort.dir === 1 ? -1 : 1 })}
        >
          {sort.dir === 1 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const people = (
            <>
              <span className="font-bold">{r.viewers}</span> <span className="text-xs text-muted-foreground">people</span>
            </>
          );
          return (
            <li key={r.reelId} className="rounded-2xl border border-border bg-card">
              <Link
                to={reelHref(r.reelId)}
                className="block cursor-pointer rounded-t-2xl p-4 pb-2 active:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <p className="line-clamp-2 font-medium leading-snug">{r.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.track}{showStudy && ` · ${r.studyTitle}`}</p>
              </Link>
              <div className="px-4 pb-4">
                <div className="flex items-baseline gap-4 font-mono text-sm tabular-nums">
                  {onShowWatchers ? (
                    <button
                      type="button"
                      onClick={() => onShowWatchers(r)}
                      className="min-h-9 cursor-pointer underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {people}
                    </button>
                  ) : (
                    <span>{people}</span>
                  )}
                  <span><span className="font-bold">{pct(r.completionRate)}</span> <span className="text-xs text-muted-foreground">finished</span></span>
                  {r.openCount > 0 && (
                    <span className="text-primary"><span className="font-bold">{r.openCount}</span> <span className="text-xs">open</span></span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs tabular-nums">
                  {[
                    { label: "Rings true", value: r.trueCount, icon: Check, color: "#3FE0A0" },
                    { label: "Surprised me", value: r.surprisedCount, icon: Zap, color: "#FFC23D" },
                    { label: "Push back", value: r.pushbackCount, icon: CircleQuestionMark, color: "#FF5A5F" },
                    { label: "Comments", value: r.commentCount, icon: MessageSquare, color: "#93A0B8" },
                  ].map((m) => (
                    <span
                      key={m.label}
                      aria-label={`${m.label}: ${m.value}`}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                      style={{ background: `${m.color}1f`, color: m.color }}
                    >
                      <m.icon className="size-3" strokeWidth={2.5} /> {m.value}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
