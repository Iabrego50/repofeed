import { describe, expect, it } from "vitest";
import { NOT_FOUND_META, metaForPath } from "./document-meta";

describe("per-route document meta", () => {
  it("sets public titles and noindexes the 404 page", () => {
    // Root lands new visitors on the product story; marketing lives at /landing.
    expect(metaForPath("/").title).toMatch(/Welcome/);
    expect(metaForPath("/landing").title).toMatch(/Research your team will actually watch/);
    expect(metaForPath("/demo").title).toMatch(/Demo/);
    expect(metaForPath("/demo/explore").title).toMatch(/Explore demo/);
    expect(metaForPath("/help").title).toMatch(/Help/);
    expect(metaForPath("/signin").title).toMatch(/Sign in/);
    expect(metaForPath("/terms").title).toMatch(/Terms/);
    expect(metaForPath("/privacy").title).toMatch(/Privacy/);
    expect(metaForPath("/feed").title).toMatch(/Feed/);
    expect(metaForPath("/feed").robots).toMatch(/noindex/);
    expect(metaForPath("/explore").title).toMatch(/Explore/);
    expect(metaForPath("/explore").robots).toMatch(/noindex/);
    expect(metaForPath("/explore").title).not.toMatch(/not found/i);
    expect(metaForPath("/this-is-missing")).toEqual(NOT_FOUND_META);
    expect(NOT_FOUND_META.robots).toBe("noindex");
    expect(metaForPath("/admin/analytics").robots).toMatch(/noindex/);
  });
});
