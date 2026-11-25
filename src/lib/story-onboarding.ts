import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabase";

/** Only the completion timestamp is stored — answers are session-local / visual only. */
export const STORY_META = {
  completedAt: "story_onboarding_completed_at",
} as const;

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
