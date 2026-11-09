import { track as vercelTrack } from "@vercel/analytics";
import { getBrowserSupabase } from "./supabase";

export const ANALYTICS_EVENTS = [
  "session_start",
  "signup",
  "first_upload",
  "generate_started",
  "generate_completed",
  "generate_failed",
  "feed_open",
  "reel_open",
  "scene_view",
  "heart",
  "save",
  "comment",
  "evidence_open",
  "checkout_started",
  "subscription_started",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export type Attribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  signup_referrer: string | null;
  landing_path: string | null;
};

export const ATTRIBUTION_STORAGE_KEY = "repofeed.attribution";
export const ANONYMOUS_ID_KEY = "repofeed.anonymous_id";
export const SESSION_ID_KEY = "repofeed.session_id";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

let sessionStartSent = false;

function storageGet(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(
  storage: Storage | undefined,
  key: string,
  value: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Private mode / quota.
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  const existing = storageGet(window.localStorage, ANONYMOUS_ID_KEY);
  if (existing) return existing;
  const id = newId();
  storageSet(window.localStorage, ANONYMOUS_ID_KEY, id);
  return id;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = storageGet(window.sessionStorage, SESSION_ID_KEY);
  if (existing) return existing;
  const id = newId();
  storageSet(window.sessionStorage, SESSION_ID_KEY, id);
  return id;
}

function readParam(
  params: URLSearchParams,
  key: (typeof UTM_KEYS)[number],
): string | null {
  const value = params.get(key)?.trim();
  return value ? value.slice(0, 200) : null;
}

export function captureFirstTouchAttribution(
  location: { pathname: string; search: string } | URL = window.location,
  referrer = typeof document !== "undefined" ? document.referrer : "",
): Attribution | null {
  if (typeof window === "undefined") return null;
  const existing = readStoredAttribution();
  if (existing) return existing;

  const params =
    location instanceof URL
      ? location.searchParams
      : new URLSearchParams(location.search);
  const host =
    typeof window !== "undefined" ? window.location.host : location instanceof URL
      ? location.host
      : "";
  let signupReferrer: string | null = null;
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      if (refUrl.host !== host) signupReferrer = referrer.slice(0, 500);
    } catch {
      signupReferrer = referrer.slice(0, 500);
    }
  }
  const landingPath =
    (location instanceof URL ? location.pathname : location.pathname) +
    (location instanceof URL
      ? location.search
      : location.search || "");

  const attribution: Attribution = {
    utm_source: readParam(params, "utm_source"),
    utm_medium: readParam(params, "utm_medium"),
    utm_campaign: readParam(params, "utm_campaign"),
    utm_term: readParam(params, "utm_term"),
    utm_content: readParam(params, "utm_content"),
    signup_referrer: signupReferrer,
    landing_path: landingPath.slice(0, 500) || "/",
  };
  storageSet(
    window.localStorage,
    ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(attribution),
  );
  return attribution;
}

export function readStoredAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const raw = storageGet(window.localStorage, ATTRIBUTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    return {
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
      utm_term: parsed.utm_term ?? null,
      utm_content: parsed.utm_content ?? null,
      signup_referrer: parsed.signup_referrer ?? null,
      landing_path: parsed.landing_path ?? null,
    };
  } catch {
    return null;
  }
}

export function attributionColumns(
  attribution: Attribution | null,
): Record<string, string | null> | null {
  if (!attribution) return null;
  return {
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    signup_referrer: attribution.signup_referrer,
    landing_path: attribution.landing_path,
  };
}

/** Persist first-touch UTMs onto the profile and fire signup if this is a new user. */
export async function completeSignup(args: {
  client: { from: (table: string) => any };
  user: {
    id: string;
    email?: string | null;
    user_metadata?: { name?: string; avatar_url?: string };
  };
}): Promise<{ isNew: boolean }> {
  const users = args.client.from("users");
  const existing = await users
    .select("id, utm_source")
    .eq("id", args.user.id)
    .maybeSingle();
  const isNew = !existing.data?.id;

  await users.upsert(
    {
      id: args.user.id,
      email: args.user.email,
      name: args.user.user_metadata?.name,
      avatar: args.user.user_metadata?.avatar_url,
      token_identifier: args.user.id,
    },
    { onConflict: "id" },
  );

  const columns = attributionColumns(readStoredAttribution());
  if (columns && isNew) {
    await users.update(columns).eq("id", args.user.id);
  }

  if (isNew) {
    await trackAsync("signup", {
      ...flattenProps(columns ?? {}),
    });
  }
  return { isNew };
}

function flattenProps(
  props: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}

function currentPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.pathname}${window.location.search}`.slice(0, 500);
}

export type TrackOptions = AnalyticsProps & {
  workspaceId?: string | null;
  path?: string | null;
};

/**
 * Client helper used at product funnel points.
 * Sends a Vercel custom event and appends a row to analytics_events.
 */
export function track(event: AnalyticsEvent, props: TrackOptions = {}): void {
  void trackAsync(event, props);
}

export async function trackAsync(
  event: AnalyticsEvent,
  props: TrackOptions = {},
): Promise<void> {
  if (typeof window !== "undefined") {
    captureFirstTouchAttribution();
  }
  if (event !== "session_start") {
    await ensureSessionStart();
  }

  const { workspaceId, path, ...rest } = props;
  const anonymousId = getAnonymousId();
  const sessionId = getSessionId();
  const resolvedPath = path ?? currentPath();
  const vercelProps = flattenProps({
    ...rest,
    workspaceId: workspaceId ?? undefined,
    path: resolvedPath,
  });

  try {
    vercelTrack(event, vercelProps);
  } catch {
    // Analytics must never break the product.
  }

  const client = getBrowserSupabase();
  if (!client) return;
  try {
    await client.from("analytics_events").insert({
      event,
      workspace_id: workspaceId || null,
      anonymous_id: anonymousId || null,
      session_id: sessionId || null,
      path: resolvedPath ?? null,
      properties: flattenProps(rest),
    });
  } catch {
    // Swallow — event log is best-effort on the client.
  }
}

async function ensureSessionStart(): Promise<void> {
  if (sessionStartSent) return;
  if (typeof window === "undefined") return;
  const flag = storageGet(window.sessionStorage, "repofeed.session_start_sent");
  if (flag === "1") {
    sessionStartSent = true;
    return;
  }
  sessionStartSent = true;
  storageSet(window.sessionStorage, "repofeed.session_start_sent", "1");
  await trackAsync("session_start");
}

export function startAnalyticsSession(): void {
  if (typeof window === "undefined") return;
  captureFirstTouchAttribution();
  void ensureSessionStart();
}

/** Reset in-memory session flags (tests). */
export function resetAnalyticsSessionForTests(): void {
  sessionStartSent = false;
}
