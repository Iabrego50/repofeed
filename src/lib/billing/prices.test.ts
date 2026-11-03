import { describe, expect, it } from "vitest";
import { resolveStripePortalConfiguration, resolveStripePriceId, stripePriceEnvNames } from "./prices";

describe("Stripe price env resolution", () => {
  it("prefers monthly/yearly ids and falls back to STRIPE_PRICE_PRO / TEAM", () => {
    expect(stripePriceEnvNames("pro", "month")).toEqual(["STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO"]);
    expect(stripePriceEnvNames("pro", "year")).toEqual(["STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRICE_PRO"]);
    expect(stripePriceEnvNames("team", "month")).toEqual(["STRIPE_PRICE_TEAM_MONTHLY", "STRIPE_PRICE_TEAM"]);
    expect(stripePriceEnvNames("team", "year")).toEqual(["STRIPE_PRICE_TEAM_YEARLY", "STRIPE_PRICE_TEAM"]);

    expect(
      resolveStripePriceId("pro", "year", {
        STRIPE_PRICE_PRO_YEARLY: "price_year",
        STRIPE_PRICE_PRO: "price_legacy",
      }),
    ).toBe("price_year");
    expect(resolveStripePriceId("pro", "year", { STRIPE_PRICE_PRO: "price_legacy" })).toBe("price_legacy");
    expect(resolveStripePriceId("team", "month", {})).toBeUndefined();
  });

  it("reads STRIPE_PORTAL_CONFIGURATION only when set", () => {
    expect(resolveStripePortalConfiguration({})).toBeUndefined();
    expect(resolveStripePortalConfiguration({ STRIPE_PORTAL_CONFIGURATION: "   " })).toBeUndefined();
    expect(resolveStripePortalConfiguration({ STRIPE_PORTAL_CONFIGURATION: "bpc_repofeed" })).toBe("bpc_repofeed");
  });
});
