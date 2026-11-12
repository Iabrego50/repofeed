import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, CircleQuestionMark, Zap } from "lucide-react";
import HelpHint from "@/components/help-hint.tsx";
import { cn } from "@/lib/utils.ts";
import ReelStatList from "./reel-stat-list.tsx";
import { AUDIENCES, COLUMNS, forAudience, nextSort, pct, type Audience, type DashboardRow, type DashboardSummary, type Sort } from "../_lib/columns.ts";

const REACTIONS = [
  { key: "true", label: "Rings true", icon: Check, color: "var(--success)" },
  { key: "surprised", label: "Surprised me", icon: Zap, color: "var(--warning)" },
  { key: "pushback", label: "Push back", icon: CircleQuestionMark, color: "var(--destructive)" },
] as const;

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-xs font-medium text-muted-foreground sm:text-[11px]">{label}</p>
        {hint && <HelpHint title={label} article="insights" className="-my-1 -mr-1.5 size-6">{hint}</HelpHint>}
      </div>
      <p className="mt-1.5 truncate text-3xl font-bold tabular-nums sm:mt-2 sm:text-4xl">{value}</p>
      {sub && <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{sub}</p>}
    </div>
  );
}

function HeadlineStats({ summary, audience }: { summary: DashboardSummary; audience: Audience }) {
  const { reached, memberCount, guestsReached } = summary;
  const reach =
    audience === "team"
      ? { value: `${reached} / ${memberCount}`, sub: "team members who watched" }
      : audience === "guests"
        ? { value: String(guestsReached), sub: "named guests from share links" }
        : { value: String(reached + guestsReached), sub: `${reached}/${memberCount} team${guestsReached ? ` + ${guestsReached} guest${guestsReached === 1 ? "" : "s"}` : ""}` };
  const finish = audience === "team" ? summary.teamCompletionRate : audience === "guests" ? summary.guestCompletionRate : summary.completionRate;
  return (
    <>
      <Stat label="People reached" value={reach.value} sub={reach.sub} hint="Team members who watched at least one scene, plus guests who added their name on a share link. Guests who only watch aren't counted by name." />
      <Stat label="Finished" value={pct(finish)} sub="of viewers watched to the end" hint="Of the people who started a scene, the share who watched it all the way to the end." />
      <Stat label="Open items" value={String(summary.openItems)} sub="unresolved questions and actions" hint="Questions and action items left in comments that nobody has marked Resolved yet." />
      <Stat label="Total plays" value={summary.totalViews.toLocaleString()} sub="max one per person per scene a day" hint="Counts at most one play per person, per scene, per day, so rewatching doesn't inflate the number." />
    </>
  );
}

function TopList({ title, rows, metric, icon: Icon, color, reelHref }: { title: string; rows: DashboardRow[]; metric: "pushbackCount" | "surprisedCount"; icon: typeof Check; color: string; reelHref: (id: string) => string }) {
  const top = [...rows].filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric]).slice(0, 5);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5" style={{ color }} /> {title}
      </h2>
      {top.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No reactions yet.</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {top.map((r, i) => (
            <li key={r.reelId}>
              <Link to={reelHref(r.reelId)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                <span className="text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
                <span className="text-sm font-bold" style={{ color }}>{r[metric]}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Everyone / Team / Guests switch shown above the dashboard. */
export function AudienceToggle({ value, onChange }: { value: Audience; onChange: (a: Audience) => void }) {
  return (
    <div role="radiogroup" aria-label="Show" className="grid grid-cols-3 rounded-xl border border-border bg-card p-1 sm:inline-grid">
      {AUDIENCES.map((a) => (
        <button
          key={a.value}
          type="button"
          role="radio"
          aria-checked={value === a.value}
          onClick={() => onChange(a.value)}
          className={cn(
            "h-9 cursor-pointer rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            value === a.value && "bg-secondary text-foreground",
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

type Props<R extends DashboardRow> = {
  summary: Omit<DashboardSummary, "rows"> & { rows: R[] };
  audience: Audience;
  showStudy: boolean;
  reelHref: (reelId: string) => string;
  /** Omitted in the public demo, where there is no real watcher list. */
  onShowWatchers?: (row: R) => void;
};

/** Headline stats, reactions, top lists and the sortable scene table. Shared by Insights and the demo. */
export default function InsightsDashboard<R extends DashboardRow>({ summary, audience, showStudy, reelHref, onShowWatchers }: Props<R>) {
  const [sort, setSort] = useState<Sort>({ key: "viewers", dir: -1 });
  const rows = useMemo(
    () =>
      summary.rows.map((r) => forAudience(r, audience)).sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        return (typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv)) * sort.dir;
      }),
    [summary, sort, audience],
  );

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <HeadlineStats summary={summary} audience={audience} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:mt-4 sm:gap-4">
        {REACTIONS.map((r) => (
          <div key={r.label} className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full sm:size-12" style={{ background: `color-mix(in srgb, ${r.color} 14%, transparent)`, color: r.color }}>
              <r.icon className="size-4 sm:size-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">{summary.reactions[r.key]}</p>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{r.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-2">
        <TopList title="Most pushed back" rows={summary.rows} metric="pushbackCount" icon={CircleQuestionMark} color="var(--destructive)" reelHref={reelHref} />
        <TopList title="Most surprising" rows={summary.rows} metric="surprisedCount" icon={Zap} color="var(--warning)" reelHref={reelHref} />
      </div>

      <div className="md:hidden">
        <ReelStatList rows={rows} sort={sort} onSortChange={setSort} showStudy={showStudy} reelHref={reelHref} onShowWatchers={onShowWatchers} />
      </div>

      <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-3 py-2 text-[11px] text-muted-foreground", c.numeric ? "text-right" : "text-left")}>
                    <button
                      type="button"
                      onClick={() => setSort((s) => nextSort(s, c.key))}
                      className={cn("inline-flex min-h-10 cursor-pointer items-center gap-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", active && "text-foreground")}
                    >
                      {c.label}
                      {active && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.reelId} className="border-b border-border last:border-0 hover:bg-accent/60">
                {COLUMNS.map((c) =>
                  c.key === "title" ? (
                    <td key={c.key} className="max-w-[280px] px-3 py-2">
                      <Link to={reelHref(r.reelId)} className="block cursor-pointer truncate font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">
                        {r.title}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{r.track}{showStudy && ` · ${r.studyTitle}`}</span>
                    </td>
                  ) : c.key === "viewers" && onShowWatchers ? (
                    <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                      <button
                        type="button"
                        onClick={() => onShowWatchers(r)}
                        className="min-h-9 cursor-pointer underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                        aria-label={`See who watched ${r.title}`}
                      >
                        {r.viewers}
                      </button>
                    </td>
                  ) : (
                    <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                      {c.fmt ? c.fmt(r) : r[c.key]}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
