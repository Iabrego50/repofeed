import type { CampaignRow } from "@/lib/api/admin-acquisition.ts";

export type Verdict = { tone: "good" | "watch" | "bad" | "neutral"; label: string; why: string };

/** A paying Pro seat is $29 a month, so this is roughly a three-month payback. */
export const CAC_TARGET_CENTS = 9000;
const MIN_VISITS = 50;

/**
 * A plain-language read on one campaign. The thresholds are deliberately simple
 * and written out in `why`, so the call can be checked by eye against the row.
 */
export function campaignVerdict(row: CampaignRow): Verdict {
  if (row.spendCents === 0 && row.sessions < MIN_VISITS) {
    return { tone: "neutral", label: "Too early", why: `Fewer than ${MIN_VISITS} visits so far.` };
  }
  if (row.customers > 0 && row.cacCents != null) {
    return row.cacCents <= CAC_TARGET_CENTS
      ? { tone: "good", label: "Scale it", why: "Customers are costing less than three months of Pro revenue." }
      : { tone: "watch", label: "Pricey", why: "It converts, but each customer costs more than three months of Pro revenue." };
  }
  if (row.customers > 0) {
    return { tone: "good", label: "Converting", why: "Paying customers with no spend logged against it." };
  }
  if (row.sessions >= MIN_VISITS && row.signups === 0) {
    return { tone: "bad", label: "Fix the page", why: "People click through but nobody signs up. Check that the page headline matches the ad." };
  }
  if (row.visitToSignup != null && row.sessions >= MIN_VISITS && row.visitToSignup < 2) {
    return { tone: "watch", label: "Leaky", why: "Under 2 signups per 100 visits." };
  }
  if (row.signups >= 5 && row.activated === 0) {
    return { tone: "watch", label: "Wrong crowd", why: "Signups arrive but none have made a study." };
  }
  if (row.spendCents > 0 && row.signups === 0) {
    return { tone: "bad", label: "Pause", why: "Money spent, no signups in this window." };
  }
  return { tone: "neutral", label: "Keep watching", why: "Signups are coming in. No paying customer yet." };
}
