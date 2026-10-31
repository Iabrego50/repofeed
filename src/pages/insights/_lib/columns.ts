import type { FunctionReturnType } from '@/convex/_generated/server';
import type { api } from "@/convex/_generated/api";

export type Summary = FunctionReturnType<typeof api.insights.summary>;
export type Row = Summary["rows"][number];
/** Row shape the dashboard renders; plain string ids so the public demo can supply sample data. */
export type DashboardRow = Omit<Row, "reelId" | "studyId"> & { reelId: string; studyId: string };
export type DashboardSummary = Omit<Summary, "rows" | "studies"> & { rows: DashboardRow[] };
export type SortKey = "title" | "viewers" | "completionRate" | "trueCount" | "surprisedCount" | "pushbackCount" | "commentCount" | "openCount";
export type Sort = { key: SortKey; dir: 1 | -1 };
export type Audience = "everyone" | "team" | "guests";

export const AUDIENCES: Array<{ value: Audience; label: string }> = [
  { value: "everyone", label: "Everyone" },
  { value: "team", label: "Team" },
  { value: "guests", label: "Guests" },
];

export const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Narrows a row's people and completion numbers to the chosen audience. */
export function forAudience<R extends DashboardRow>(r: R, audience: Audience): R {
  if (audience === "everyone") return r;
  const viewers = audience === "team" ? r.teamViewers : r.guestViewers;
  const completions = audience === "team" ? r.teamCompletions : r.guestCompletions;
  return { ...r, viewers, completions, completionRate: viewers ? completions / viewers : 0 };
}

export const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean; fmt?: (r: DashboardRow) => string }> = [
  { key: "title", label: "Scene", numeric: false },
  { key: "viewers", label: "People", numeric: true },
  { key: "completionRate", label: "Finished", numeric: true, fmt: (r) => pct(r.completionRate) },
  { key: "trueCount", label: "Rings true", numeric: true },
  { key: "surprisedCount", label: "Surprised me", numeric: true },
  { key: "pushbackCount", label: "Push back", numeric: true },
  { key: "commentCount", label: "Comments", numeric: true },
  { key: "openCount", label: "Open", numeric: true },
];

/** Clicking the active column flips direction; a new column starts high-to-low for numbers. */
export function nextSort(current: Sort, key: SortKey): Sort {
  const numeric = COLUMNS.find((c) => c.key === key)?.numeric ?? true;
  return { key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : numeric ? -1 : 1 };
}
