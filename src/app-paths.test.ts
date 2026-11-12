import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEED_PATH, LANDING_PATH, signInPath } from "./app-paths";

describe("signInPath", () => {
  it("omits returnTo for the landing page and the default feed", () => {
    expect(signInPath()).toBe("/signin");
    expect(signInPath(LANDING_PATH)).toBe("/signin");
    expect(signInPath(FEED_PATH)).toBe("/signin");
    expect(signInPath("/signin")).toBe("/signin");
  });

  it("keeps a deep in-app path so sign-in can send people back", () => {
    expect(signInPath("/studies/abc")).toBe("/signin?returnTo=%2Fstudies%2Fabc");
    expect(signInPath("/explore?q=churn")).toBe("/signin?returnTo=%2Fexplore%3Fq%3Dchurn");
  });
});

describe("production SPA rewrites", () => {
  it("rewrites /feed and /explore to index.html so a hard refresh does not 404", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      rewrites?: Array<{ source: string; destination: string }>;
    };
    const sources = new Set(
      (vercel.rewrites ?? [])
        .filter((rule) => rule.destination === "/index.html")
        .map((rule) => rule.source),
    );
    expect(sources.has("/")).toBe(true);
    expect(sources.has("/feed")).toBe(true);
    expect(sources.has("/explore")).toBe(true);
    expect(sources.has("/dashboard")).toBe(true);
  });
});
