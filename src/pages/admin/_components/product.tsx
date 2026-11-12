import type { AdminAnalyticsSnapshot } from "@/lib/api/admin-analytics.ts";
import { num, pct, seconds } from "../_lib/format.ts";
import { CountList, DailyBars, Funnel, Kpi, Panel, TD, TH } from "./parts.tsx";

function Health({ title, ok, failed, rate, avg, okLabel }: { title: string; ok: number; failed: number; rate: number | null; avg: number | null; okLabel: string }) {
  return (
    <Panel title={title}>
      {ok + failed === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this window yet.</p>
      ) : (
        <dl className="grid grid-cols-4 gap-3 text-sm">
          {[
            [okLabel, num(ok)],
            ["Failed", num(failed)],
            ["Success rate", pct(rate)],
            ["Average time", seconds(avg)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

export default function ProductTab({ snapshot, rangeLabel }: { snapshot: AdminAnalyticsSnapshot; rangeLabel: string }) {
  const { headlines, engagement, generation, plans, demo, signups, product } = snapshot;
  const hasTrend = product.daily.some((day) => day.signups || day.studies || day.reels || day.views);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visits" value={num(product.visits)} sub="unique sessions in this window" />
        <Kpi label="Signups" value={num(headlines.users)} sub={`${num(headlines.usersLifetime)} all time`} />
        <Kpi label="Studies" value={num(headlines.studies)} sub={rangeLabel} />
        <Kpi label="Scenes generated" value={num(headlines.reels)} sub={`${num(headlines.videosGenerated)} with AI video`} />
        <Kpi label="Scene views" value={num(engagement.views)} sub={`${num(engagement.viewers)} unique viewers, all time`} />
        <Kpi
          label="Plays in this window"
          value={num(product.viewsInRange)}
          sub={`${num(product.viewersInRange)} people or guests`}
        />
        <Kpi label="Active, last 7 days" value={num(headlines.active7d)} sub="signed-in people with any event" />
        <Kpi label="Paid workspaces" value={num(plans.paidWorkspaces)} sub={plans.mix.map((row) => `${row.name} ${row.count}`).join(", ") || "all free"} />
      </div>

      <Panel title="Activity over time" hint={rangeLabel}>
        {hasTrend ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <DailyBars data={product.daily} dataKey="signups" title="Signups" total={signups.total} color="var(--chart-1)" />
            <DailyBars data={product.daily} dataKey="studies" title="Studies" total={headlines.studies} color="var(--chart-2)" />
            <DailyBars data={product.daily} dataKey="reels" title="Scenes" total={headlines.reels} color="var(--chart-3)" />
            <DailyBars data={product.daily} dataKey="views" title="Plays" total={product.viewsInRange} color="var(--chart-4)" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No signups, studies, scenes or plays in this window yet.</p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="From a visit to a first scene" hint="People who signed up in this window, followed forward. Visits include guests.">
          <Funnel steps={product.funnel} />
        </Panel>
        <Panel title="Demo feed" hint="Visitors who opened the public demo.">
          {demo.sessions === 0 ? (
            <p className="text-sm text-muted-foreground">No demo sessions in this window.</p>
          ) : (
            <Funnel
              steps={[
                { key: "demo_session", label: "Opened the demo", count: demo.sessions },
                { key: "demo_interact", label: "Reacted, saved or commented", count: demo.interacted },
                { key: "demo_signup", label: "Signed up afterwards", count: demo.signedUp },
              ]}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Engagement" hint={rangeLabel}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Reactions", engagement.hearts],
              ["Saves", engagement.saves],
              ["Comments", engagement.comments],
              ["Evidence opened", engagement.evidenceOpens],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-2xl font-bold">{num(Number(value))}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Signups by source">
          <CountList rows={signups.bySource} empty="No signups in this window." />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Signups by referring site">
          <CountList rows={signups.byReferrer} empty="No referrers in this window." />
        </Panel>
        <Panel title="Workspaces created" hint={rangeLabel}>
          <p className="text-2xl font-bold">{num(headlines.workspaces)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {num(headlines.active30d)} signed-in people were active in the last 30 days.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Health title="Study generation" okLabel="Finished" ok={generation.studyJobs.done} failed={generation.studyJobs.failed} rate={generation.studyJobs.successRate} avg={generation.studyJobs.avgSeconds} />
        <Health title="Video rendering" okLabel="Rendered" ok={generation.videos.completed} failed={generation.videos.failed} rate={generation.videos.successRate} avg={generation.videos.avgSeconds} />
      </div>

      <Panel title="Workspaces" hint="Plan and AI video use against each plan's cap.">
        {plans.usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspaces in this view.</p>
        ) : (
          <div className="-mx-3 overflow-x-auto">
            <table className="w-full min-w-[34rem]">
              <thead>
                <tr>
                  <th className={TH}>Workspace</th>
                  <th className={TH}>Plan</th>
                  <th className={`${TH} text-right`}>Studies</th>
                  <th className={`${TH} text-right`}>Videos</th>
                  <th className={`${TH} text-right`}>Cap</th>
                  <th className={TH}>Billing</th>
                </tr>
              </thead>
              <tbody>
                {plans.usage.map((row) => (
                  <tr key={row.workspaceId} className="border-t border-border">
                    <td className={`${TD} font-medium`}>{row.name}</td>
                    <td className={`${TD} capitalize`}>{row.plan}</td>
                    <td className={`${TD} text-right`}>{row.studies}</td>
                    <td className={`${TD} text-right`}>{row.videos}</td>
                    <td className={`${TD} text-right text-muted-foreground`}>{row.cap}</td>
                    <td className={`${TD} text-muted-foreground`}>{row.customerId ? "Stripe customer" : row.paid ? "Paid" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
