import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { COLORS, pct, reactionData, topByCompletion, topByViews, truncate, type Deck } from "../_lib/deck.ts";

const tick = { fill: COLORS.fg, fontSize: 17, fontFamily: "Instrument Sans Variable, sans-serif" };

export function ViewsChart({ deck, animate }: { deck: Deck; animate: boolean }) {
  const data = topByViews(deck.reels).map((r) => ({ name: truncate(r.title, 30), views: r.viewers }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 70, bottom: 0, left: 0 }} barCategoryGap="22%">
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={300} tick={tick} axisLine={false} tickLine={false} />
        <Bar dataKey="views" radius={[0, 8, 8, 0]} isAnimationActive={animate}>
          {data.map((_, i) => <Cell key={i} fill={i === 0 ? COLORS.coral : "#24304A"} />)}
          <LabelList dataKey="views" position="right" fill={COLORS.fg} fontSize={17} fontFamily="JetBrains Mono, monospace" formatter={(v: unknown) => Number(v).toLocaleString()} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CompletionChart({ deck, animate }: { deck: Deck; animate: boolean }) {
  const data = topByCompletion(deck.reels).map((r) => ({ name: truncate(r.title, 30), rate: Math.round(r.completionRate * 100) }));
  const avg = Math.round(deck.stats.completionRate * 100);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 28, right: 70, bottom: 0, left: 0 }} barCategoryGap="22%">
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="name" width={300} tick={tick} axisLine={false} tickLine={false} />
        <ReferenceLine x={avg} stroke={COLORS.muted} strokeDasharray="4 6" label={{ value: `average ${avg}%`, position: "top", fill: COLORS.muted, fontSize: 15 }} />
        <Bar dataKey="rate" radius={[0, 8, 8, 0]} isAnimationActive={animate}>
          {data.map((d, i) => <Cell key={i} fill={d.rate >= avg ? COLORS.green : COLORS.amber} />)}
          <LabelList dataKey="rate" position="right" fill={COLORS.fg} fontSize={17} fontFamily="JetBrains Mono, monospace" formatter={(v: unknown) => `${String(v)}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReactionsChart({ deck, animate }: { deck: Deck; animate: boolean }) {
  const data = reactionData(deck);
  const total = data.reduce((n, d) => n + d.value, 0);
  // Zero-value slices still get padding, which leaves odd gaps in the ring.
  const slices = data.filter((d) => d.value > 0);
  return (
    <div className="flex h-full items-center gap-14">
      <div className="relative h-[300px] w-[300px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? slices : [{ name: "none", value: 1, color: COLORS.border }]}
              dataKey="value"
              innerRadius={98}
              outerRadius={146}
              paddingAngle={slices.length > 1 ? 3 : 0}
              stroke="none"
              isAnimationActive={animate}
            >
              {(total ? slices : [{ color: COLORS.border }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-[64px] font-extrabold leading-none">{total}</p>
            <p className="mt-1 text-[18px] text-[#93A0B8]">reactions</p>
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-6">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-5">
            <span className="size-5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-[26px]">{d.name}</span>
            <span className="font-mono text-[30px] font-bold tabular-nums">{d.value}</span>
            <span className="w-20 text-right font-mono text-[20px] text-[#93A0B8]">{total ? pct(d.value / total) : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
