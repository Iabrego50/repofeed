import { describe, expect, it } from "vitest";
import { EDITOR_LIMIT, FREE_STUDY_LIMIT, TEAM_MIN_SEATS } from "./billing/limits";
import { PLANS } from "./plans";

describe("public plans match enforced limits", () => {
  it("does not claim SSO or custom branding", () => {
    const text = PLANS.flatMap((plan) => plan.features).join(" ").toLowerCase();
    expect(text).not.toMatch(/\bsso\b/);
    expect(text).not.toMatch(/custom branding/);
  });

  it("advertises the free study and editor limits that limits.ts enforces", () => {
    const free = PLANS.find((plan) => plan.id === "free");
    const pro = PLANS.find((plan) => plan.id === "pro");
    const team = PLANS.find((plan) => plan.id === "team");
    expect(free?.features.join(" ")).toMatch(new RegExp(`${FREE_STUDY_LIMIT} active studies`));
    expect(free?.features.join(" ")).toMatch(new RegExp(`${EDITOR_LIMIT.free} editor`));
    expect(pro?.features.join(" ")).toMatch(new RegExp(`${EDITOR_LIMIT.pro} editor`));
    expect(team?.features.join(" ")).toMatch(/min\. 2/);
    expect(TEAM_MIN_SEATS).toBe(2);
  });
});
