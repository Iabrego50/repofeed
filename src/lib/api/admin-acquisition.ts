/**
 * Paid-acquisition view for the admin dashboard: which campaigns bring visits,
 * which of those visits sign up, activate and pay, and what each one cost.
 * Pure functions only, so the numbers can be unit-tested without a database.
 */

export type AcqUser = {
  id: string;
  created_at: string;
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

export type AcqEvent = {
  event: string;
  created_at: string;
  user_id: string | null;
  workspace_id?: string | null;
  session_id: string | null;
  path: string | null;
  properties: unknown;
};

export type AcqWorkspace = {
  id: string;
  created_by: string;
  paid_plan: string | null;
  seats?: number | null;
};

export type SpendEntry = {
  id: string;
  period_start: string;
  period_end: string;
  source: string;
  medium: string | null;
  campaign: string;
  amount_cents: number;
  note: string | null;
};

export type Channel =
  | "Paid search"
  | "Paid social"
  | "Other paid"
  | "Email"
  | "Organic search"
  | "Organic social"
  | "Referral"
  | "Direct";

export type CampaignRow = {
  key: string;
  source: string;
  medium: string;
  campaign: string;
  channel: Channel;
  sessions: number;
  ctaClicks: number;
  signups: number;
  activated: number;
  checkouts: number;
  customers: number;
  spendCents: number;
  /** Signups per 100 visits. Null until there is a visit to divide by. */
  visitToSignup: number | null;
  signupToPaid: number | null;
  costPerSignupCents: number | null;
  cacCents: number | null;
};

export type BreakdownRow = {
  name: string;
  sessions: number;
  signups: number;
  customers: number;
  visitToSignup: number | null;
};

export type DailyPoint = { day: string; sessions: number; signups: number; customers: number };

export type ConversionRow = {
  at: string;
  type: "signup" | "paid";
  clickId: string;
  clickIdType: string;
  campaign: string;
};

export type Acquisition = {
  totals: {
    sessions: number;
    paidSessions: number;
    signups: number;
    paidSignups: number;
    activated: number;
    customers: number;
    spendCents: number;
    costPerSignupCents: number | null;
    cacCents: number | null;
    visitToSignup: number | null;
    estMrrCents: number;
  };
  channels: Array<{ channel: Channel; sessions: number; signups: number; customers: number; spendCents: number }>;
  campaigns: CampaignRow[];
  creatives: BreakdownRow[];
  keywords: BreakdownRow[];
  landings: BreakdownRow[];
  daily: DailyPoint[];
  conversions: ConversionRow[];
  spend: SpendEntry[];
};

const MS_DAY = 86_400_000;

/** Monthly list price per seat, used only for the MRR estimate. */
const LIST_PRICE_CENTS: Record<string, number> = { pro: 2900, team: 5900 };

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search", "paidsocial", "paid_social", "paid-social", "display", "ads", "ad", "sponsored", "cpm", "retargeting"]);
const SOCIAL = ["linkedin", "facebook", "meta", "instagram", "twitter", "x.com", "t.co", "tiktok", "reddit", "youtube", "threads", "bluesky"];
const SEARCH = ["google", "bing", "duckduckgo", "yahoo", "brave", "ecosia", "kagi"];
const PAID_CLICK_IDS = new Set(["gclid", "gbraid", "wbraid", "msclkid", "li_fat_id", "fbclid", "ttclid", "twclid"]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function props(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function classifyChannel(touch: {
  source?: string | null;
  medium?: string | null;
  referrer?: string | null;
  clickIdType?: string | null;
}): Channel {
  const source = clean(touch.source).toLowerCase();
  const medium = clean(touch.medium).toLowerCase();
  const clickType = clean(touch.clickIdType).toLowerCase();
  const paid = PAID_MEDIUMS.has(medium) || PAID_CLICK_IDS.has(clickType);
  if (paid) {
    if (includesAny(source, SOCIAL) || ["li_fat_id", "fbclid", "ttclid", "twclid"].includes(clickType) || medium.includes("social")) {
      return "Paid social";
    }
    if (includesAny(source, SEARCH) || ["gclid", "gbraid", "wbraid", "msclkid"].includes(clickType) || medium.includes("search")) {
      return "Paid search";
    }
    return "Other paid";
  }
  if (medium === "email" || medium === "newsletter" || source === "newsletter") return "Email";
  if (source) {
    if (includesAny(source, SOCIAL) || medium === "social") return "Organic social";
    if (includesAny(source, SEARCH) || medium === "organic") return "Organic search";
    return "Referral";
  }
  const referrer = clean(touch.referrer).toLowerCase();
  if (!referrer) return "Direct";
  const host = hostOf(referrer);
  if (includesAny(host, SEARCH)) return "Organic search";
  if (includesAny(host, SOCIAL)) return "Organic social";
  return "Referral";
}

export function isPaidChannel(channel: Channel): boolean {
  return channel === "Paid search" || channel === "Paid social" || channel === "Other paid";
}

function campaignKey(source: string, medium: string, campaign: string): string {
  return [source, medium, campaign].map((part) => part.toLowerCase()).join("\u001f");
}

function inRange(iso: string | null | undefined, start: Date | null, now: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > now.getTime()) return false;
  return !start || t >= start.getTime();
}

function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function per(cents: number, count: number): number | null {
  return cents > 0 && count > 0 ? Math.round(cents / count) : null;
}

function pathOnly(value: string | null | undefined): string {
  const raw = clean(value);
  if (!raw) return "(unknown)";
  const cut = raw.split("?")[0].split("#")[0];
  return cut || "/";
}

/** Share of a spend entry that falls inside the reporting window, by days. */
export function spendInWindow(entry: SpendEntry, start: Date | null, now: Date): number {
  const from = Date.parse(`${entry.period_start}T00:00:00Z`);
  const to = Date.parse(`${entry.period_end}T00:00:00Z`) + MS_DAY;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  const windowFrom = start ? Math.max(from, start.getTime()) : from;
  // Today counts as a whole day, so a period ending today isn't short-changed.
  const windowTo = Math.min(to, Math.ceil(now.getTime() / MS_DAY) * MS_DAY);
  if (windowTo <= windowFrom) return 0;
  return Math.round(entry.amount_cents * ((windowTo - windowFrom) / (to - from)));
}

type Bucket = {
  source: string;
  medium: string;
  campaign: string;
  channel: Channel;
  sessions: Set<string>;
  ctaSessions: Set<string>;
  signups: number;
  activated: number;
  checkouts: number;
  customers: number;
  spendCents: number;
};

type Tally = { sessions: number; signups: number; customers: number };

function bump(map: Map<string, Tally>, name: string, field: keyof Tally) {
  const row = map.get(name) ?? { sessions: 0, signups: 0, customers: 0 };
  row[field] += 1;
  map.set(name, row);
}

function breakdown(map: Map<string, Tally>, limit = 12): BreakdownRow[] {
  return [...map.entries()]
    .map(([name, tally]) => ({ name, ...tally, visitToSignup: rate(tally.signups, tally.sessions) }))
    .sort((a, b) => b.signups - a.signups || b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildAcquisition(input: {
  users: AcqUser[];
  events: AcqEvent[];
  workspaces: AcqWorkspace[];
  spend: SpendEntry[];
  start: Date | null;
  now: Date;
}): Acquisition {
  const { users, events, workspaces, spend, start, now } = input;
  const buckets = new Map<string, Bucket>();
  const bucketFor = (touch: { source: string; medium: string; campaign: string; referrer?: string | null; clickIdType?: string | null }) => {
    const channel = classifyChannel(touch);
    const source = touch.source || (touch.referrer ? hostOf(touch.referrer) : "(direct)");
    const medium = touch.medium || (touch.source ? "(not set)" : channel === "Direct" ? "(none)" : "referral");
    const campaign = touch.campaign || "(not set)";
    const key = campaignKey(source, medium, campaign);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { source, medium, campaign, channel, sessions: new Set(), ctaSessions: new Set(), signups: 0, activated: 0, checkouts: 0, customers: 0, spendCents: 0 };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  const creatives = new Map<string, Tally>();
  const keywords = new Map<string, Tally>();
  const landings = new Map<string, Tally>();
  const daily = new Map<string, DailyPoint>();
  const day = (iso: string) => {
    const key = iso.slice(0, 10);
    let point = daily.get(key);
    if (!point) {
      point = { day: key, sessions: 0, signups: 0, customers: 0 };
      daily.set(key, point);
    }
    return point;
  };

  // Visits: one per session, credited to the campaign tags that session arrived with.
  const ranged = events.filter((event) => inRange(event.created_at, start, now));
  const seenSessions = new Set<string>();
  for (const event of ranged) {
    if (event.event !== "session_start") continue;
    const id = event.session_id ?? `${event.created_at}:${event.path ?? ""}`;
    if (seenSessions.has(id)) continue;
    seenSessions.add(id);
    const p = props(event.properties);
    const bucket = bucketFor({
      source: clean(p.utm_source),
      medium: clean(p.utm_medium),
      campaign: clean(p.utm_campaign),
      clickIdType: clean(p.click_id_type),
    });
    bucket.sessions.add(id);
    day(event.created_at).sessions += 1;
    if (clean(p.utm_content)) bump(creatives, clean(p.utm_content), "sessions");
    if (clean(p.utm_term)) bump(keywords, clean(p.utm_term), "sessions");
    bump(landings, pathOnly(event.path), "sessions");
  }
  for (const event of ranged) {
    if (event.event !== "cta_click" || !event.session_id) continue;
    const p = props(event.properties);
    bucketFor({
      source: clean(p.utm_source),
      medium: clean(p.utm_medium),
      campaign: clean(p.utm_campaign),
      clickIdType: clean(p.click_id_type),
    }).ctaSessions.add(event.session_id);
  }

  // People: credited to the first-touch tags saved on their profile at signup.
  const eventsByUser = new Map<string, Set<string>>();
  for (const event of events) {
    if (!event.user_id) continue;
    const names = eventsByUser.get(event.user_id) ?? new Set<string>();
    names.add(event.event);
    eventsByUser.set(event.user_id, names);
  }
  const paidAt = new Map<string, string>();
  for (const event of events) {
    if (event.event !== "subscription_started" || !event.workspace_id) continue;
    const current = paidAt.get(event.workspace_id);
    if (!current || event.created_at < current) paidAt.set(event.workspace_id, event.created_at);
  }
  // A paying workspace counts once, for the person who created it.
  const paidByOwner = new Map<string, AcqWorkspace[]>();
  for (const workspace of workspaces) {
    if (!workspace.paid_plan) continue;
    const list = paidByOwner.get(workspace.created_by) ?? [];
    list.push(workspace);
    paidByOwner.set(workspace.created_by, list);
  }

  const conversions: ConversionRow[] = [];
  const cohort = users.filter((user) => inRange(user.created_at, start, now));
  const cohortIds = new Set(cohort.map((user) => user.id));
  let activatedTotal = 0;
  for (const user of cohort) {
    const bucket = bucketFor({
      source: clean(user.utm_source),
      medium: clean(user.utm_medium),
      campaign: clean(user.utm_campaign),
      referrer: user.signup_referrer,
      clickIdType: user.click_id_type,
    });
    bucket.signups += 1;
    day(user.created_at).signups += 1;
    const names = eventsByUser.get(user.id);
    if (names?.has("generate_started")) {
      bucket.activated += 1;
      activatedTotal += 1;
    }
    if (names?.has("checkout_started")) bucket.checkouts += 1;
    const owned = paidByOwner.get(user.id) ?? [];
    bucket.customers += owned.length;
    const content = clean(user.utm_content);
    const term = clean(user.utm_term);
    const landing = pathOnly(user.landing_path);
    if (content) bump(creatives, content, "signups");
    if (term) bump(keywords, term, "signups");
    bump(landings, landing, "signups");
    for (const workspace of owned) {
      if (content) bump(creatives, content, "customers");
      if (term) bump(keywords, term, "customers");
      bump(landings, landing, "customers");
      const at = paidAt.get(workspace.id);
      if (at && inRange(at, start, now)) day(at).customers += 1;
    }
    if (user.click_id) {
      const campaign = clean(user.utm_campaign) || "(not set)";
      const clickIdType = clean(user.click_id_type) || "unknown";
      conversions.push({ at: user.created_at, type: "signup", clickId: user.click_id, clickIdType, campaign });
      for (const workspace of owned) {
        conversions.push({ at: paidAt.get(workspace.id) ?? user.created_at, type: "paid", clickId: user.click_id, clickIdType, campaign });
      }
    }
  }

  // Spend: matched to a campaign row by source + campaign name (case-insensitive).
  let spendTotal = 0;
  for (const entry of spend) {
    const cents = spendInWindow(entry, start, now);
    if (cents <= 0) continue;
    spendTotal += cents;
    const source = entry.source.trim().toLowerCase();
    const campaign = entry.campaign.trim().toLowerCase();
    const match = [...buckets.values()].find(
      (bucket) => bucket.source.toLowerCase() === source && bucket.campaign.toLowerCase() === campaign,
    );
    const bucket =
      match ??
      bucketFor({ source: entry.source.trim(), medium: clean(entry.medium) || "cpc", campaign: entry.campaign.trim() });
    bucket.spendCents += cents;
  }

  const campaigns: CampaignRow[] = [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      source: bucket.source,
      medium: bucket.medium,
      campaign: bucket.campaign,
      channel: bucket.channel,
      sessions: bucket.sessions.size,
      ctaClicks: bucket.ctaSessions.size,
      signups: bucket.signups,
      activated: bucket.activated,
      checkouts: bucket.checkouts,
      customers: bucket.customers,
      spendCents: bucket.spendCents,
      visitToSignup: rate(bucket.signups, bucket.sessions.size),
      signupToPaid: rate(bucket.customers, bucket.signups),
      costPerSignupCents: per(bucket.spendCents, bucket.signups),
      cacCents: per(bucket.spendCents, bucket.customers),
    }))
    .sort(
      (a, b) =>
        b.spendCents - a.spendCents || b.customers - a.customers || b.signups - a.signups || b.sessions - a.sessions,
    );

  const channelMap = new Map<Channel, { sessions: number; signups: number; customers: number; spendCents: number }>();
  for (const row of campaigns) {
    const entry = channelMap.get(row.channel) ?? { sessions: 0, signups: 0, customers: 0, spendCents: 0 };
    entry.sessions += row.sessions;
    entry.signups += row.signups;
    entry.customers += row.customers;
    entry.spendCents += row.spendCents;
    channelMap.set(row.channel, entry);
  }
  const channels = [...channelMap.entries()]
    .map(([channel, entry]) => ({ channel, ...entry }))
    .sort((a, b) => b.sessions - a.sessions || b.signups - a.signups);

  const sum = (pick: (row: CampaignRow) => number, only?: (row: CampaignRow) => boolean) =>
    campaigns.filter(only ?? (() => true)).reduce((total, row) => total + pick(row), 0);
  const paidOnly = (row: CampaignRow) => isPaidChannel(row.channel);
  const sessions = sum((row) => row.sessions);
  const signups = sum((row) => row.signups);
  const customers = sum((row) => row.customers);
  const paidSignups = sum((row) => row.signups, paidOnly);
  const paidCustomers = sum((row) => row.customers, paidOnly);

  const estMrrCents = workspaces
    .filter((workspace) => workspace.paid_plan && cohortIds.has(workspace.created_by))
    .reduce((total, workspace) => {
      const price = LIST_PRICE_CENTS[workspace.paid_plan ?? ""] ?? 0;
      const seats = workspace.paid_plan === "team" ? Math.max(2, workspace.seats ?? 2) : 1;
      return total + price * seats;
    }, 0);

  return {
    totals: {
      sessions,
      paidSessions: sum((row) => row.sessions, paidOnly),
      signups,
      paidSignups,
      activated: activatedTotal,
      customers,
      spendCents: spendTotal,
      // Spend only buys paid traffic, so cost is divided by what paid traffic produced.
      costPerSignupCents: per(spendTotal, paidSignups),
      cacCents: per(spendTotal, paidCustomers),
      visitToSignup: rate(signups, sessions),
      estMrrCents,
    },
    channels,
    campaigns,
    creatives: breakdown(creatives),
    keywords: breakdown(keywords),
    landings: breakdown(landings),
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    conversions: conversions.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 2000),
    spend: [...spend].sort((a, b) => b.period_start.localeCompare(a.period_start)),
  };
}
