import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabase";

/** Only the completion timestamp is stored — answers are session-local / visual only. */
export const STORY_META = {
  completedAt: "story_onboarding_completed_at",
} as const;

/** Signed-out web visitors: remember they finished/skipped the product story. */
export const GUEST_STORY_DONE_KEY = "repofeed_guest_story_done";

/** Native (iOS) viewer onboarding — separate from the researcher product story. */
export const VIEWER_ONBOARDING_DONE_KEY = "repofeed_viewer_onboarding_done";

/** Plan chosen on the story sign-up step; consumed after workspace creation. */
export const PENDING_PLAN_KEY = "repofeed_pending_plan";

export const STORY_ROLES = [
  "researcher",
  "pm",
  "designer",
  "marketer",
  "founder",
  "other",
] as const;

export type StoryRole = (typeof STORY_ROLES)[number];

/** Session-local choices for the channel preview card — never written to user_metadata. */
export type StorySession = {
  role?: StoryRole;
  channelName: string;
};

export const ROLE_LABELS: Record<StoryRole, string> = {
  researcher: "Researcher",
  pm: "Product manager",
  designer: "Designer",
  marketer: "Marketer",
  founder: "Founder",
  other: "Other",
};

export function emptyStorySession(): StorySession {
  return { channelName: "Team research" };
}

export function hasCompletedStoryOnboarding(user: User | null | undefined): boolean {
  if (!user) return false;
  const value = user.user_metadata?.[STORY_META.completedAt];
  return typeof value === "string" && value.length > 0;
}

function readLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeLocalFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* private mode / blocked storage — ignore */
  }
}

/** Guest (signed-out) finished or skipped the web product story. */
export function hasCompletedGuestStory(): boolean {
  return readLocalFlag(GUEST_STORY_DONE_KEY);
}

export function markGuestStoryComplete(): void {
  writeLocalFlag(GUEST_STORY_DONE_KEY);
}

/**
 * Web: show the researcher product story when the visitor is signed out and
 * has not finished it yet. Signed-in completion uses user_metadata.
 */
export function shouldShowWebStory(user: User | null | undefined): boolean {
  if (user) return !hasCompletedStoryOnboarding(user);
  return !hasCompletedGuestStory();
}

export function hasCompletedViewerOnboarding(): boolean {
  return readLocalFlag(VIEWER_ONBOARDING_DONE_KEY);
}

export function markViewerOnboardingComplete(): void {
  writeLocalFlag(VIEWER_ONBOARDING_DONE_KEY);
}

export type PendingPlan = { plan: "pro" | "team"; interval: "month" | "year" };

export function setPendingPlan(plan: PendingPlan): void {
  try {
    sessionStorage.setItem(PENDING_PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* ignore */
  }
}

export function takePendingPlan(): PendingPlan | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PLAN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_PLAN_KEY);
    const parsed = JSON.parse(raw) as PendingPlan;
    if (
      (parsed.plan === "pro" || parsed.plan === "team") &&
      (parsed.interval === "month" || parsed.interval === "year")
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Suggest a channel name from the account email domain, falling back to a brand-safe default. */
export function suggestChannelName(email: string | null | undefined): string {
  const domain = email?.split("@")[1]?.split(".")[0] ?? "";
  const personal = [
    "gmail",
    "outlook",
    "hotmail",
    "yahoo",
    "icloud",
    "proton",
    "protonmail",
    "me",
    "live",
    "aol",
  ];
  if (!domain || personal.includes(domain.toLowerCase())) return "Team research";
  const brand = domain.charAt(0).toUpperCase() + domain.slice(1);
  return `${brand} insights`;
}

/** Mark the product story complete so it does not auto-replay. Does not store answers. */
export async function markStoryOnboardingComplete(): Promise<void> {
  const client = getBrowserSupabase();
  if (!client) return;
  const { error } = await client.auth.updateUser({
    data: {
      [STORY_META.completedAt]: new Date().toISOString(),
    },
  });
  if (error) throw error;
}
