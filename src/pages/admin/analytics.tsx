import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsonAuthHeaders } from "@/lib/api/bearer";
import NotFound from "@/pages/NotFound.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { cn } from "@/lib/utils.ts";
import type {
  AdminAnalyticsRange,
  AdminAnalyticsSnapshot,
  FunnelStep,
  NamedCount,
} from "@/lib/api/admin-analytics.ts";

const RANGES: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${n}%`;
}

function formatSeconds(n: number | null): string {
  if (n == null) return "—";
  if (n < 60) return `${n}s`;
  return `${Math.round((n / 60) * 10) / 10}m`;
}

async function fetchSnapshot(
  range: AdminAnalyticsRange,
  excludeInternal: boolean,
): Promise<AdminAnalyticsSnapshot | "not-found"> {
  let headers: Record<string, string>;
  try {
    headers = await jsonAuthHeaders();
  } catch {
    return "not-found";
  }
  const params = new URLSearchParams({
    range,
    excludeInternal: excludeInternal ? "1" : "0",
  });
  const response = await fetch(`/api/admin/analytics?${params}`, { headers });
  if (response.status === 404 || response.status === 401 || response.status === 403) {
    return "not-found";
  }
  if (!response.ok) {
    throw new Error("Couldn't load analytics");
  }
  return (await response.json()) as AdminAnalyticsSnapshot;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1.5 truncate font-display text-3xl font-extrabold tabular-nums sm:mt-2 sm:text-4xl">
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CountList({ rows, empty }: { rows: NamedCount[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <ol className="space-y-2">
      {rows.slice(0, 8).map((row) => (
        <li key={row.name} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }}
              />
            </div>
          </div>
          <span className="font-mono text-sm font-bold tabular-nums">{row.count}</span>
        </li>
      ))}
    </ol>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((step) => step.count), 1);
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => {
        const prev = i === 0 ? step.count : steps[i - 1].count;
        const conv = prev > 0 ? Math.round((step.count / prev) * 100) : 0;
        return (
          <li key={step.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{step.label}</p>
              <p className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatNumber(step.count)}
                {i > 0 && <span className="ml-2">{conv}%</span>}
              </p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(step.count ? 4 : 0, (step.count / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<AdminAnalyticsRange>("30d");
  const [excludeInternal, setExcludeInternal] = useState(true);

  const query = useQuery({
    queryKey: ["admin", "analytics", range, excludeInternal],
    queryFn: () => fetchSnapshot(range, excludeInternal),
    retry: false,
    staleTime: 30_000,
  });

  const snapshot = query.data && query.data !== "not-found" ? query.data : null;
  const notFound = query.data === "not-found";

  const rangeLabel = useMemo(
    () => RANGES.find((item) => item.value === range)?.label ?? range,
    [range],
  );

  if (notFound) return <NotFound />;
  if (query.isError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-5 text-center text-sm text-muted-foreground">
        Something went wrong.
      </div>
    );
  }
  if (query.isLoading || !snapshot) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-6 sm:px-5 sm:py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Internal"
          title="Product analytics"
          description="Signups, activation, engagement and generation health. Not linked from the app."
          actions={
            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div
                role="radiogroup"
                aria-label="Date range"
                className="grid grid-cols-3 rounded-xl border border-border bg-card p-1"
              >
                {RANGES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={range === item.value}
                    onClick={() => setRange(item.value)}
                    className={cn(
                      "min-h-9 cursor-pointer rounded-lg px-3 text-xs font-semibold sm:text-sm",
                      range === item.value
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Switch
                  id="exclude-internal"
                  checked={excludeInternal}
                  onCheckedChange={setExcludeInternal}
                />
                <Label htmlFor="exclude-internal" className="text-xs sm:text-sm">
                  Hide internal accounts
                </Label>
              </div>
            </div>
          }
        />

            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Users"
                value={formatNumber(snapshot.headlines.users)}
                sub={`${formatNumber(snapshot.headlines.usersLifetime)} all-time · ${rangeLabel}`}
              />
              <Stat
                label="Workspaces"
                value={formatNumber(snapshot.headlines.workspaces)}
                sub={rangeLabel}
              />
              <Stat
                label="Studies"
                value={formatNumber(snapshot.headlines.studies)}
                sub={rangeLabel}
              />
              <Stat
                label="Videos generated"
                value={formatNumber(snapshot.headlines.videosGenerated)}
                sub={`${formatNumber(snapshot.headlines.reels)} scenes`}
              />
              <Stat
                label="Active 7d"
                value={formatNumber(snapshot.headlines.active7d)}
                sub="from events"
              />
              <Stat
                label="Active 30d"
                value={formatNumber(snapshot.headlines.active30d)}
                sub="from events"
              />
              <Stat
                label="Deduped views"
                value={formatNumber(snapshot.engagement.views)}
                sub={`${formatNumber(snapshot.engagement.viewers)} viewers`}
              />
              <Stat
                label="Paid workspaces"
                value={formatNumber(snapshot.plans.paidWorkspaces)}
                sub={snapshot.plans.mix.map((row) => `${row.name} ${row.count}`).join(" · ") || "all free"}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card title="Activation funnel">
                <Funnel steps={snapshot.funnel} />
              </Card>
              <Card title="Demo funnel">
                <Funnel
                  steps={[
                    { key: "demo_session", label: "Demo sessions", count: snapshot.demo.sessions },
                    { key: "demo_interact", label: "Interacted", count: snapshot.demo.interacted },
                    { key: "demo_signup", label: "Signed up after demo", count: snapshot.demo.signedUp },
                  ]}
                />
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title="Signups by source">
                <CountList rows={snapshot.signups.bySource} empty="No signups in this range." />
              </Card>
              <Card title="Signups by referrer">
                <CountList rows={snapshot.signups.byReferrer} empty="No referrers in this range." />
              </Card>
            </div>

            {snapshot.signups.byDay.length > 0 && (
              <Card title="Signups over time">
                <div className="flex h-32 items-end gap-1 sm:gap-1.5">
                  {snapshot.signups.byDay.map((day) => {
                    const max = Math.max(...snapshot.signups.byDay.map((item) => item.signups), 1);
                    return (
                      <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-primary"
                          style={{ height: `${Math.max(6, (day.signups / max) * 100)}%` }}
                          title={`${day.day}: ${day.signups}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {snapshot.signups.byDay[0]?.day} → {snapshot.signups.byDay.at(-1)?.day}
                </p>
              </Card>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Hearts" value={formatNumber(snapshot.engagement.hearts)} />
              <Stat label="Saves" value={formatNumber(snapshot.engagement.saves)} />
              <Stat label="Comments" value={formatNumber(snapshot.engagement.comments)} />
              <Stat label="Evidence opens" value={formatNumber(snapshot.engagement.evidenceOpens)} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title="Study generation">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Succeeded</dt>
                    <dd className="font-display text-2xl font-extrabold">
                      {formatNumber(snapshot.generation.studyJobs.done)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Failed</dt>
                    <dd className="font-display text-2xl font-extrabold">
                      {formatNumber(snapshot.generation.studyJobs.failed)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Success rate</dt>
                    <dd className="font-mono font-bold">
                      {formatPct(snapshot.generation.studyJobs.successRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Avg time</dt>
                    <dd className="font-mono font-bold">
                      {formatSeconds(snapshot.generation.studyJobs.avgSeconds)}
                    </dd>
                  </div>
                </dl>
              </Card>
              <Card title="Video generation">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="font-display text-2xl font-extrabold">
                      {formatNumber(snapshot.generation.videos.completed)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Failed</dt>
                    <dd className="font-display text-2xl font-extrabold">
                      {formatNumber(snapshot.generation.videos.failed)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Success rate</dt>
                    <dd className="font-mono font-bold">
                      {formatPct(snapshot.generation.videos.successRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Avg render</dt>
                    <dd className="font-mono font-bold">
                      {formatSeconds(snapshot.generation.videos.avgSeconds)}
                    </dd>
                  </div>
                </dl>
                {snapshot.generation.videos.byProvider.length > 0 && (
                  <ul className="mt-4 space-y-1 text-sm">
                    {snapshot.generation.videos.byProvider.map((row) => (
                      <li key={row.provider} className="flex justify-between gap-3">
                        <span className="font-medium">{row.provider}</span>
                        <span className="font-mono text-muted-foreground">
                          {row.completed} ok / {row.failed} fail · {formatSeconds(row.avgSeconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Plan usage vs video caps">
              {snapshot.plans.usage.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces in this view.</p>
              ) : (
                <div className="-mx-2 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-bold">Workspace</th>
                        <th className="px-2 py-2 font-bold">Plan</th>
                        <th className="px-2 py-2 font-bold">Videos</th>
                        <th className="px-2 py-2 font-bold">Cap</th>
                        <th className="px-2 py-2 font-bold">Stripe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.plans.usage.map((row) => (
                        <tr key={row.workspaceId} className="border-t border-border">
                          <td className="px-2 py-2.5 font-medium">{row.name}</td>
                          <td className="px-2 py-2.5 font-mono text-xs uppercase">{row.plan}</td>
                          <td className="px-2 py-2.5 font-mono tabular-nums">{row.videos}</td>
                          <td className="px-2 py-2.5 font-mono tabular-nums">{row.cap}</td>
                          <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                            {row.customerId ? "customer" : row.paid ? "paid" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
      </div>
    </div>
  );
}
