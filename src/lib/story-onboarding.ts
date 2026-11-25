import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabase";

/** Keys stored on `user.user_metadata` — no DB migration required. */
export const STORY_META = {
  completedAt: "story_onboarding_completed_at",
  role: "story_role",
  researchKinds: "story_research_kinds",
  shareAudience: "story_share_audience",
  channelName: "story_channel_name",
} as const;

export const STORY_ROLES = [
  "researcher",
  "pm",
  "designer",
  "marketer",
  "founder",
  "other",
] as const;

export const STORY_RESEARCH_KINDS = [
  "interviews",
  "surveys",
  "reports",
  "usability",
  "market",
] as const;

export const STORY_SHARE_AUDIENCES = [
  "just_me",
  "my_team",
  "my_company",
  "clients",
] as const;

export type StoryRole = (typeof STORY_ROLES)[number];
export type StoryResearchKind = (typeof STORY_RESEARCH_KINDS)[number];
export type StoryShareAudience = (typeof STORY_SHARE_AUDIENCES)[number];

export type StoryAnswers = {
  role?: StoryRole;
  researchKinds: StoryResearchKind[];
  shareAudience?: StoryShareAudience;
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

export const RESEARCH_LABELS: Record<StoryResearchKind, string> = {
  interviews: "Interviews",
  surveys: "Surveys",
  reports: "Reports",
  usability: "Usability tests",
  market: "Market research",
};

export const SHARE_LABELS: Record<StoryShareAudience, string> = {
  just_me: "Just me",
  my_team: "My team",
  my_company: "My company",
  clients: "Clients",
};

export function emptyStoryAnswers(): StoryAnswers {
  return { researchKinds: [], channelName: "" };
}

export function hasCompletedStoryOnboarding(user: User | null | undefined): boolean {
  if (!user) return false;
  const value = user.user_metadata?.[STORY_META.completedAt];
  return typeof value === "string" && value.length > 0;
}

export function readStoryAnswers(user: User | null | undefined): StoryAnswers {
  const meta = user?.user_metadata ?? {};
  const role = meta[STORY_META.role];
  const share = meta[STORY_META.shareAudience];
  const kinds = meta[STORY_META.researchKinds];
  const name = meta[STORY_META.channelName];
  return {
    role: STORY_ROLES.includes(role as StoryRole) ? (role as StoryRole) : undefined,
    shareAudience: STORY_SHARE_AUDIENCES.includes(share as StoryShareAudience)
      ? (share as StoryShareAudience)
      : undefined,
    researchKinds: Array.isArray(kinds)
      ? kinds.filter((k): k is StoryResearchKind =>
          STORY_RESEARCH_KINDS.includes(k as StoryResearchKind),
        )
      : [],
    channelName: typeof name === "string" ? name : "",
  };
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

export async function persistStoryOnboarding(answers: StoryAnswers): Promise<void> {
  const client = getBrowserSupabase();
  if (!client) return;
  const { error } = await client.auth.updateUser({
    data: {
      [STORY_META.completedAt]: new Date().toISOString(),
      [STORY_META.role]: answers.role ?? null,
      [STORY_META.researchKinds]: answers.researchKinds,
      [STORY_META.shareAudience]: answers.shareAudience ?? null,
      [STORY_META.channelName]: answers.channelName.trim() || null,
    },
  });
  if (error) throw error;
}

/** Mark complete without overwriting prior answers (skip / replay finish). */
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
