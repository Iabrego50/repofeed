import { hasAiVideo, studyVideoCap } from "./reel-video.js";
import type { ReelFootageLike, ReelVideo, ReelVideoProvider } from "./reel-video.js";
import type { Json } from "../database.types.js";
import { buildAcquisition, type Acquisition, type SpendEntry } from "./admin-acquisition.js";

export const ADMIN_ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;
export type AdminAnalyticsRange = (typeof ADMIN_ANALYTICS_RANGES)[number];

export const INTERNAL_EMAIL_DOMAIN = "mail.grokbot.com";

export type AdminAnalyticsQuery = {
  range: AdminAnalyticsRange;
  excludeInternal: boolean;
};

type AnalyticsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      range: (from: number, to: number) => PromiseLike<{
        data: unknown[] | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

export type NamedCount = { name: string; count: number };

export type FunnelStep = { key: string; label: string; count: number };

export type SignupDay = {
  day: string;
  signups: number;
};

export type VideoProviderStat = {
  provider: string;
  completed: number;
  failed: number;
  avgSeconds: number | null;
};

export type PlanUsageRow = {
  workspaceId: string;
  name: string;
  plan: "free" | "pro" | "team";
  paid: boolean;
  customerId: string | null;
  studies: number;
  videos: number;
  cap: number;
};

export type AdminAnalyticsSnapshot = {
  range: AdminAnalyticsRange;
  excludeInternal: boolean;
  generatedAt: string;
  headlines: {
    users: number;
    usersLifetime: number;
    workspaces: number;
    studies: number;
    reels: number;
    videosGenerated: number;
    active7d: number;
    active30d: number;
  };
  signups: {
    total: number;
    byDay: SignupDay[];
    bySource: NamedCount[];
    byReferrer: NamedCount[];
  };
  funnel: FunnelStep[];
  engagement: {
    views: number;
    viewers: number;
    hearts: number;
    saves: number;
    comments: number;
    evidenceOpens: number;
  };
  demo: {
    sessions: number;
    interacted: number;
    signedUp: number;
  };
  generation: {
    studyJobs: { done: number; failed: number; successRate: number | null; avgSeconds: number | null };
    videos: {
      completed: number;
      failed: number;
      successRate: number | null;
      avgSeconds: number | null;
      byProvider: VideoProviderStat[];
    };
  };
  plans: {
    mix: NamedCount[];
    paidWorkspaces: number;
    usage: PlanUsageRow[];
  };
  acquisition: Acquisition;
};

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  is_admin: boolean | null;
  utm_source: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  signup_referrer: string | null;
  landing_path: string | null;
  click_id?: string | null;
  click_id_type?: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  paid_plan: string | null;
  customer_id: string | null;
  seats?: number | null;
};

type MemberRow = { workspace_id: string; user_id: string };

type StudyRow = { id: string; workspace_id: string; created_at: string };

type ReelRow = {
  id: string;
  study_id: string;
  workspace_id: string;
  created_at: string;
  footage: ReelFootageLike;
  video: ReelVideo | null;
};

type JobRow = {
  id: string;
  status: string;
  started_by: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  event: string;
  created_at: string;
  user_id: string | null;
  workspace_id?: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  path: string | null;
  properties: Json;
};

type CounterRow = { views: number | null; viewers: number | null };
type ReactionRow = { user_id: string | null; created_at: string; kind: string | null };
type CommentRow = { user_id: string | null; created_at: string };
type SavedRow = { user_id: string; created_at: string };

export type AdminAnalyticsTables = {
  users: UserRow[];
  workspaces: WorkspaceRow[];
  members: MemberRow[];
  studies: StudyRow[];
  reels: ReelRow[];
  jobs: JobRow[];
  events: EventRow[];
  counters: CounterRow[];
  reactions: ReactionRow[];
  comments: CommentRow[];
  saved: SavedRow[];
  /** Admin-entered ad spend. Optional so older callers and tests keep working. */
  spend?: SpendEntry[];
};

const MS_DAY = 86_400_000;
const PAGE = 1000;

export function parseAdminAnalyticsQuery(search: {
  range?: string | string[];
  excludeInternal?: string | string[];
}): AdminAnalyticsQuery {
  const rangeRaw = Array.isArray(search.range) ? search.range[0] : search.range;
  const range = ADMIN_ANALYTICS_RANGES.includes(rangeRaw as AdminAnalyticsRange)
    ? (rangeRaw as AdminAnalyticsRange)
    : "30d";
  const excludeRaw = Array.isArray(search.excludeInternal)
    ? search.excludeInternal[0]
    : search.excludeInternal;
  const excludeInternal = excludeRaw !== "0" && excludeRaw !== "false";
  return { range, excludeInternal };
}

export function rangeStart(range: AdminAnalyticsRange, now: Date): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * MS_DAY);
}

export function isInternalAccount(user: {
  is_admin?: boolean | null;
  email?: string | null;
}): boolean {
  if (user.is_admin) return true;
  const email = user.email?.trim().toLowerCase() ?? "";
  return email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

function inRange(iso: string | null | undefined, start: Date | null, now: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  if (t > now.getTime()) return false;
  if (start && t < start.getTime()) return false;
  return true;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function propsDemo(properties: Json): boolean {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return false;
  return (properties as { demo?: unknown }).demo === true;
}

function isDemoEvent(event: EventRow): boolean {
  if (propsDemo(event.properties)) return true;
  return (event.path ?? "").startsWith("/demo");
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function avgSeconds(rows: { created_at: string; updated_at: string }[]): number | null {
  const durations = rows
    .map((row) => (Date.parse(row.updated_at) - Date.parse(row.created_at)) / 1000)
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (durations.length === 0) return null;
  return Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
}

function videoDurationSeconds(video: ReelVideo | null | undefined): number | null {
  if (!video?.startedAt || !video.completedAt) return null;
  const n = (Date.parse(video.completedAt) - Date.parse(video.startedAt)) / 1000;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function namedCounts(values: Array<string | null | undefined>, empty = "(none)"): NamedCount[] {
  const map = new Map<string, number>();
  for (const value of values) {
    const name = (value ?? "").trim() || empty;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildAdminAnalytics(
  tables: AdminAnalyticsTables,
  query: AdminAnalyticsQuery,
  now = new Date(),
): AdminAnalyticsSnapshot {
  const start = rangeStart(query.range, now);
  const start7 = new Date(now.getTime() - 7 * MS_DAY);
  const start30 = new Date(now.getTime() - 30 * MS_DAY);

  const internalIds = new Set(
    tables.users.filter(isInternalAccount).map((user) => user.id),
  );
  const keepUser = (id: string | null | undefined) =>
    Boolean(id) && (!query.excludeInternal || !internalIds.has(id!));

  const users = tables.users.filter((user) => keepUser(user.id));

  const membersByWorkspace = new Map<string, string[]>();
  for (const member of tables.members) {
    const list = membersByWorkspace.get(member.workspace_id) ?? [];
    list.push(member.user_id);
    membersByWorkspace.set(member.workspace_id, list);
  }

  const workspaces = tables.workspaces.filter((workspace) => {
    const memberIds = membersByWorkspace.get(workspace.id) ?? [workspace.created_by];
    if (!query.excludeInternal) return true;
    return memberIds.some((id) => keepUser(id));
  });
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  const studies = tables.studies.filter((study) => workspaceIds.has(study.workspace_id));
  const reels = tables.reels.filter((reel) => workspaceIds.has(reel.workspace_id));
  const jobs = tables.jobs.filter(
    (job) => workspaceIds.has(job.workspace_id) && keepUser(job.started_by),
  );

  const events = tables.events.filter((event) => {
    if (!event.user_id) return true;
    return keepUser(event.user_id);
  });

  const usersInRange = users.filter((user) => inRange(user.created_at, start, now));
  const workspacesInRange = workspaces.filter((workspace) =>
    inRange(workspace.created_at, start, now),
  );
  const studiesInRange = studies.filter((study) => inRange(study.created_at, start, now));
  const reelsInRange = reels.filter((reel) => inRange(reel.created_at, start, now));
  const videosGenerated = reelsInRange.filter((reel) => hasAiVideo(reel.footage, reel.video)).length;

  const activeFrom = (since: Date) => {
    const ids = new Set<string>();
    for (const event of events) {
      if (!event.user_id || !keepUser(event.user_id)) continue;
      if (inRange(event.created_at, since, now)) ids.add(event.user_id);
    }
    return ids.size;
  };

  const eventsByUser = new Map<string, EventRow[]>();
  for (const event of events) {
    if (!event.user_id) continue;
    const list = eventsByUser.get(event.user_id) ?? [];
    list.push(event);
    eventsByUser.set(event.user_id, list);
  }

  const userHasEvent = (userId: string, name: string | string[]) => {
    const names = new Set(Array.isArray(name) ? name : [name]);
    return (eventsByUser.get(userId) ?? []).some((event) => names.has(event.event));
  };

  const returnedWeek2 = (user: UserRow) => {
    const signup = Date.parse(user.created_at);
    if (!Number.isFinite(signup)) return false;
    const from = signup + 7 * MS_DAY;
    const to = signup + 14 * MS_DAY;
    return (eventsByUser.get(user.id) ?? []).some((event) => {
      const t = Date.parse(event.created_at);
      return t >= from && t <= to;
    });
  };

  const paidUserIds = new Set<string>();
  for (const workspace of workspaces) {
    if (!workspace.paid_plan) continue;
    for (const userId of membersByWorkspace.get(workspace.id) ?? []) {
      if (keepUser(userId)) paidUserIds.add(userId);
    }
  }

  const cohort = usersInRange;
  const funnel: FunnelStep[] = [
    { key: "signup", label: "Signed up", count: cohort.length },
    {
      key: "first_upload",
      label: "First upload",
      count: cohort.filter((user) => userHasEvent(user.id, "first_upload")).length,
    },
    {
      key: "generate_started",
      label: "First generation",
      count: cohort.filter((user) => userHasEvent(user.id, "generate_started")).length,
    },
    {
      key: "feed_open",
      label: "Opened the feed",
      count: cohort.filter((user) => userHasEvent(user.id, ["feed_open", "reel_open"])).length,
    },
    {
      key: "returned_week_2",
      label: "Returned in week 2",
      count: cohort.filter(returnedWeek2).length,
    },
    {
      key: "checkout_started",
      label: "Checkout started",
      count: cohort.filter((user) => userHasEvent(user.id, "checkout_started")).length,
    },
    {
      key: "paid",
      label: "Paid",
      count: cohort.filter((user) => paidUserIds.has(user.id)).length,
    },
  ];

  const rangedEvents = events.filter((event) => inRange(event.created_at, start, now));

  const views = tables.counters.reduce((sum, row) => sum + (row.views ?? 0), 0);
  const viewers = tables.counters.reduce((sum, row) => sum + (row.viewers ?? 0), 0);

  const demoEvents = events.filter(isDemoEvent);
  const demoSessions = new Set(
    demoEvents
      .filter((event) => event.event === "session_start")
      .map((event) => event.session_id)
      .filter((id): id is string => Boolean(id)),
  );
  const interactedSessions = new Set(
    demoEvents
      .filter((event) =>
        ["heart", "save", "comment", "evidence_open"].includes(event.event),
      )
      .map((event) => event.session_id)
      .filter((id): id is string => typeof id === "string" && demoSessions.has(id)),
  );
  const demoAnonymous = new Set(
    demoEvents
      .map((event) => event.anonymous_id)
      .filter((id): id is string => Boolean(id)),
  );
  const signedUpFromDemo = events.filter(
    (event) =>
      event.event === "signup" &&
      event.anonymous_id &&
      demoAnonymous.has(event.anonymous_id),
  ).length;

  const jobsInRange = jobs.filter((job) => inRange(job.created_at, start, now));
  const jobsDone = jobsInRange.filter((job) => job.status === "done");
  const jobsFailed = jobsInRange.filter((job) => job.status === "failed");

  const videosInRange = reelsInRange;
  const videoCompleted = videosInRange.filter((reel) => reel.video?.status === "completed");
  const videoFailed = videosInRange.filter((reel) => reel.video?.status === "failed");
  const providerNames = [
    ...new Set(
      videosInRange
        .map((reel) => reel.video?.provider)
        .filter((name): name is ReelVideoProvider => Boolean(name)),
    ),
  ].sort();
  const byProvider: VideoProviderStat[] = providerNames.map((provider) => {
    const rows = videosInRange.filter((reel) => reel.video?.provider === provider);
    const completed = rows.filter((reel) => reel.video?.status === "completed");
    const failed = rows.filter((reel) => reel.video?.status === "failed");
    const durations = completed
      .map((reel) => videoDurationSeconds(reel.video))
      .filter((n): n is number => n != null);
    return {
      provider,
      completed: completed.length,
      failed: failed.length,
      avgSeconds:
        durations.length === 0
          ? null
          : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
    };
  });
  const videoDurations = videoCompleted
    .map((reel) => videoDurationSeconds(reel.video))
    .filter((n): n is number => n != null);

  const mix = namedCounts(
    workspaces.map((workspace) => workspace.paid_plan || "free"),
    "free",
  );
  const usage: PlanUsageRow[] = workspaces.map((workspace) => {
    const plan =
      workspace.paid_plan === "team" || workspace.paid_plan === "pro"
        ? workspace.paid_plan
        : "free";
    const wsStudies = studies.filter((study) => study.workspace_id === workspace.id);
    const wsReels = reels.filter((reel) => reel.workspace_id === workspace.id);
    const videos = wsReels.filter((reel) => hasAiVideo(reel.footage, reel.video)).length;
    const studyCount = Math.max(wsStudies.length, 1);
    return {
      workspaceId: workspace.id,
      name: workspace.name,
      plan,
      paid: Boolean(workspace.paid_plan),
      customerId: workspace.customer_id,
      studies: wsStudies.length,
      videos,
      cap: studyVideoCap(plan) * studyCount,
    };
  });

  const byDayMap = new Map<string, number>();
  for (const user of usersInRange) {
    const day = dayKey(user.created_at);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
  }
  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, signups]) => ({ day, signups }));

  return {
    range: query.range,
    excludeInternal: query.excludeInternal,
    generatedAt: now.toISOString(),
    headlines: {
      users: usersInRange.length,
      usersLifetime: users.length,
      workspaces: workspacesInRange.length,
      studies: studiesInRange.length,
      reels: reelsInRange.length,
      videosGenerated,
      active7d: activeFrom(start7),
      active30d: activeFrom(start30),
    },
    signups: {
      total: usersInRange.length,
      byDay,
      bySource: namedCounts(usersInRange.map((user) => user.utm_source), "(none)"),
      byReferrer: namedCounts(
        usersInRange.map((user) =>
          user.signup_referrer ? hostOf(user.signup_referrer) : null,
        ),
        "(direct)",
      ),
    },
    funnel,
    engagement: {
      views,
      viewers,
    hearts:
      tables.reactions.filter(
        (row) =>
          row.kind === "true" &&
          inRange(row.created_at, start, now) &&
          keepUser(row.user_id),
      ).length + rangedEvents.filter((event) => event.event === "heart" && isDemoEvent(event)).length,
    saves:
      tables.saved.filter(
        (row) => inRange(row.created_at, start, now) && keepUser(row.user_id),
      ).length + rangedEvents.filter((event) => event.event === "save" && isDemoEvent(event)).length,
    comments:
      tables.comments.filter(
        (row) => inRange(row.created_at, start, now) && keepUser(row.user_id),
      ).length +
      rangedEvents.filter((event) => event.event === "comment" && isDemoEvent(event)).length,
    evidenceOpens: rangedEvents.filter((event) => event.event === "evidence_open").length,
    },
    demo: {
      sessions: demoSessions.size,
      interacted: interactedSessions.size,
      signedUp: signedUpFromDemo,
    },
    generation: {
      studyJobs: {
        done: jobsDone.length,
        failed: jobsFailed.length,
        successRate: pct(jobsDone.length, jobsDone.length + jobsFailed.length),
        avgSeconds: avgSeconds(jobsDone),
      },
      videos: {
        completed: videoCompleted.length,
        failed: videoFailed.length,
        successRate: pct(
          videoCompleted.length,
          videoCompleted.length + videoFailed.length,
        ),
        avgSeconds:
          videoDurations.length === 0
            ? null
            : Math.round(
                (videoDurations.reduce((a, b) => a + b, 0) / videoDurations.length) * 10,
              ) / 10,
        byProvider,
      },
    },
    plans: {
      mix,
      paidWorkspaces: workspaces.filter((workspace) => Boolean(workspace.paid_plan)).length,
      usage,
    },
    acquisition: buildAcquisition({
      users,
      events,
      workspaces,
      spend: tables.spend ?? [],
      start,
      now,
    }),
  };
}

async function selectAll<T>(
  client: AnalyticsClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message ?? `Failed to read ${table}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Reads a table that a not-yet-applied migration may be missing, without failing the whole dashboard. */
async function selectOptional<T>(client: AnalyticsClient, table: string, columns: string, fallbackColumns?: string): Promise<T[]> {
  try {
    return await selectAll<T>(client, table, columns);
  } catch (error) {
    if (!fallbackColumns) return [];
    console.warn(`[admin-analytics] ${table}: falling back to base columns`, error);
    return selectAll<T>(client, table, fallbackColumns);
  }
}

export async function loadAdminAnalytics(
  client: AnalyticsClient,
  query: AdminAnalyticsQuery,
  now = new Date(),
): Promise<AdminAnalyticsSnapshot> {
  const [
    users,
    workspaces,
    members,
    studies,
    reels,
    jobs,
    events,
    counters,
    reactions,
    comments,
    saved,
  ] = await Promise.all([
    selectOptional<UserRow>(
      client,
      "users",
      "id, email, created_at, is_admin, utm_source, utm_medium, utm_campaign, utm_term, utm_content, signup_referrer, landing_path, click_id, click_id_type",
      "id, email, created_at, is_admin, utm_source, utm_medium, utm_campaign, utm_term, utm_content, signup_referrer, landing_path",
    ),
    selectAll<WorkspaceRow>(
      client,
      "workspaces",
      "id, name, created_by, created_at, paid_plan, customer_id, seats",
    ),
    selectAll<MemberRow>(client, "workspace_members", "workspace_id, user_id"),
    selectAll<StudyRow>(client, "studies", "id, workspace_id, created_at"),
    selectAll<ReelRow>(client, "reels", "id, study_id, workspace_id, created_at, footage, video"),
    selectAll<JobRow>(
      client,
      "generation_jobs",
      "id, status, started_by, workspace_id, created_at, updated_at",
    ),
    selectAll<EventRow>(
      client,
      "analytics_events",
      "event, created_at, user_id, workspace_id, anonymous_id, session_id, path, properties",
    ),
    selectAll<CounterRow>(client, "reel_counters", "views, viewers"),
    selectAll<ReactionRow>(client, "reactions", "user_id, created_at, kind"),
    selectAll<CommentRow>(client, "comments", "user_id, created_at"),
    selectAll<SavedRow>(client, "saved_reels", "user_id, created_at"),
  ]);
  const spend = await selectOptional<SpendEntry>(
    client,
    "ad_spend",
    "id, period_start, period_end, source, medium, campaign, amount_cents, note",
  );

  return buildAdminAnalytics(
    {
      users,
      workspaces,
      members,
      studies,
      reels,
      jobs,
      events,
      counters,
      reactions,
      comments,
      saved,
      spend,
    },
    query,
    now,
  );
}
