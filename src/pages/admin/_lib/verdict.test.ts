import { describe, expect, it } from "vitest";
import type { CampaignRow } from "@/lib/api/admin-acquisition.ts";
import { CAC_TARGET_CENTS, campaignVerdict } from "./verdict.ts";

function row(extra: Partial<CampaignRow>): CampaignRow {
  return {
    key: "k",
    source: "google",
    medium: "cpc",
    campaign: "test",
    channel: "Paid search",
    sessions: 10,
    ctaClicks: 0,
    signups: 0,
    activated: 0,
    checkouts: 0,
    customers: 0,
    spendCents: 0,
    visitToSignup: null,
    signupToPaid: null,
    costPerSignupCents: null,
    cacCents: null,
    ...extra,
  };
}

describe("campaignVerdict", () => {
  it("ranks a cheap converting campaign above a pricey one", () => {
    expect(campaignVerdict(row({ customers: 2, cacCents: CAC_TARGET_CENTS, spendCents: 18_000 })).label).toBe("Scale it");
    expect(campaignVerdict(row({ customers: 2, cacCents: CAC_TARGET_CENTS + 1, spendCents: 18_001 })).label).toBe("Pricey");
  });

  it("calls out spend with no signups", () => {
    expect(campaignVerdict(row({ spendCents: 5000, signups: 0, sessions: 12 })).label).toBe("Pause");
  });
});
