import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { AdminAnalyticsSnapshot } from "@/lib/api/admin-analytics.ts";
import type { BreakdownRow, CampaignRow } from "@/lib/api/admin-acquisition.ts";
import { money, num, pct } from "../_lib/format.ts";
import { CAC_TARGET_CENTS, campaignVerdict, type Verdict } from "../_lib/verdict.ts";
import { DailyBars, Funnel, Kpi, Panel, TD, TH } from "./parts.tsx";

type SortKey = "spendCents" | "sessions" | "signups" | "visitToSignup" | "activated" | "customers" | "costPerSignupCents" | "cacCents";

const COLUMNS: Array<{ key: SortKey; label: string; title?: string }> = [
  { key: "spendCents", label: "Spend" },
  { key: "sessions", label: "Visits" },
  { key: "signups", label: "Signups" },
  { key: "visitToSignup", label: "Visit → signup" },
  { key: "activated", label: "Made a study", title: "Signed up and started generating at least one study" },
  { key: "customers", label: "Paying" },
  { key: "costPerSignupCents", label: "Cost / signup" },
  { key: "cacCents", label: "CAC", title: "Spend divided by paying customers" },
];

const TONE: Record<Verdict["tone"], string> = {
  good: "bg-success/12 text-success",
  watch: "bg-warning/15 text-warning",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-secondary text-muted-foreground",
};

function BreakdownTable({ rows, first, empty }: { rows: BreakdownRow[]; first: string; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-3 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className={TH}>{first}</th>
            <th className={cn(TH, "text-right")}>Visits</th>
            <th className={cn(TH, "text-right")}>Signups</th>
            <th className={cn(TH, "text-right")}>Rate</th>
            <th className={cn(TH, "text-right")}>Paying</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border">
              <td className={cn(TD, "w-full max-w-0 truncate font-medium")} title={row.name}>{row.name}</td>
              <td className={cn(TD, "text-right")}>{num(row.sessions)}</td>
              <td className={cn(TD, "text-right")}>{num(row.signups)}</td>
              <td className={cn(TD, "text-right text-muted-foreground")}>{pct(row.visitToSignup)}</td>
              <td className={cn(TD, "text-right")}>{num(row.customers)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cell(row: CampaignRow, key: SortKey): string {
  switch (key) {
    case "spendCents":
      return row.spendCents ? money(row.spendCents) : "–";
    case "visitToSignup":
      return pct(row.visitToSignup);
    case "costPerSignupCents":
      return money(row.costPerSignupCents);
    case "cacCents":
      return money(row.cacCents);
    default:
      return num(row[key]);
  }
}

export default function AcquisitionTab({ snapshot }: { snapshot: AdminAnalyticsSnapshot }) {
  const { totals, campaigns, channels, daily, creatives, keywords, landings } = snapshot.acquisition;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "spendCents", dir: -1 });
  const [paidOnly, setPaidOnly] = useState(false);

  const rows = useMemo(() => {
    const list = paidOnly ? campaigns.filter((row) => row.channel.startsWith("Paid") || row.channel === "Other paid") : campaigns;
    return [...list].sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * sort.dir || b.sessions - a.sessions);
  }, [campaigns, sort, paidOnly]);

  const payback =
    totals.cacCents != null && totals.customers > 0 && totals.estMrrCents > 0
      ? Math.round((totals.cacCents / (totals.estMrrCents / totals.customers)) * 10) / 10
      : null;
  const maxChannel = Math.max(...channels.map((c) => c.sessions), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ad spend" value={money(totals.spendCents)} sub={totals.spendCents ? "logged for this window" : "nothing logged yet"} />
        <Kpi label="Visits" value={num(totals.sessions)} sub={`${num(totals.paidSessions)} from paid ads`} />
        <Kpi label="Signups" value={num(totals.signups)} sub={`${pct(totals.visitToSignup)} of visits`} />
        <Kpi label="Cost per signup" value={money(totals.costPerSignupCents)} sub={`${num(totals.paidSignups)} paid signups`} />
        <Kpi label="Paying customers" value={num(totals.customers)} sub={`${money(totals.estMrrCents)} est. MRR`} />
        <Kpi
          emphasis
          label="CAC"
          value={money(totals.cacCents)}
          sub={payback != null ? `${payback} mo payback · target ${money(CAC_TARGET_CENTS)}` : `target under ${money(CAC_TARGET_CENTS)}`}
        />
      </div>

      <Panel title="Traffic and signups by day">
        {daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits recorded in this window yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <DailyBars data={daily} dataKey="sessions" title="Visits" total={totals.sessions} color="var(--chart-1)" />
            <DailyBars data={daily} dataKey="signups" title="Signups" total={totals.signups} color="var(--chart-4)" />
          </div>
        )}
      </Panel>

      <Panel
        title="Campaigns"
        hint="Visits use the campaign tags on the landing URL. Signups and customers use the tags saved when that person first arrived."
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Paid only
          </label>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tagged traffic yet. Build a tagged link in the Tools tab and use it as the destination URL in your ad.
          </p>
        ) : (
          <div className="-mx-3 overflow-x-auto">
            <table className="w-full min-w-[60rem]">
              <thead>
                <tr>
                  <th className={TH}>Campaign</th>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className={cn(TH, "text-right")} title={col.title} aria-sort={sort.key === col.key ? (sort.dir === -1 ? "descending" : "ascending") : undefined}>
                      <button
                        type="button"
                        onClick={() => setSort((s) => ({ key: col.key, dir: s.key === col.key ? (s.dir === -1 ? 1 : -1) : -1 }))}
                        className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-foreground", sort.key === col.key && "text-foreground")}
                      >
                        {col.label}
                        {sort.key === col.key && (sort.dir === -1 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className={TH}>Read</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const verdict = campaignVerdict(row);
                  return (
                    <tr key={row.key} className="border-t border-border">
                      <td className="max-w-[18rem] px-3 py-2.5">
                        <p className="truncate text-sm font-medium" title={row.campaign}>{row.campaign}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.source} / {row.medium} <span className="ml-1 rounded bg-secondary px-1 py-px">{row.channel}</span>
                        </p>
                      </td>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className={cn(TD, "text-right", col.key === "cacCents" && "font-semibold")}>
                          {cell(row, col.key)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <span title={verdict.why} className={cn("inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium", TONE[verdict.tone])}>
                          {verdict.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Channels" hint="Where visits come from, and what they turn into.">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits in this window.</p>
          ) : (
            <ol className="space-y-3">
              {channels.map((c) => (
                <li key={c.channel}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{c.channel}</span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{num(c.sessions)}</span> visits · {num(c.signups)} signups · {num(c.customers)} paying
                      {c.spendCents > 0 && <> · {money(c.spendCents)}</>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(c.sessions ? 3 : 0, (c.sessions / maxChannel) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Signup to paid" hint="People who signed up in this window, followed forward.">
          <Funnel steps={snapshot.funnel} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Landing pages" hint="Which page the visit started on.">
          <BreakdownTable rows={landings} first="Page" empty="No visits yet." />
        </Panel>
        <Panel title="Ad creatives" hint="From utm_content.">
          <BreakdownTable rows={creatives} first="Creative" empty="Tag ads with utm_content to compare creatives." />
        </Panel>
        <Panel title="Keywords" hint="From utm_term.">
          <BreakdownTable rows={keywords} first="Keyword" empty="Tag search ads with utm_term to compare keywords." />
        </Panel>
      </div>
    </div>
  );
}
