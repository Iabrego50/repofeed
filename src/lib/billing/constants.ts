type Plan = "free" | "pro" | "team";

export const FREE_STUDY_LIMIT = 3;
export const TRIAL_DAYS = 14;
export const TEAM_MIN_SEATS = 2;
export const FEATURE_PRO = "Share links";
export const FEATURE_TEAM = "Adding more editors";

export const EDITOR_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: 1,
  team: Number.POSITIVE_INFINITY,
};

export function teamSeats(editors: number): number {
  return Math.max(TEAM_MIN_SEATS, editors);
}
