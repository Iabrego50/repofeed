import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  emptyStorySession,
  hasCompletedStoryOnboarding,
  STORY_META,
  suggestChannelName,
} from "./story-onboarding";

function user(meta: Record<string, unknown> = {}): User {
  return {
    id: "u1",
    email: "alex@northwind.com",
    app_metadata: {},
    user_metadata: meta,
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  } as User;
}

describe("story onboarding metadata", () => {
  it("treats missing completion flag as incomplete", () => {
    expect(hasCompletedStoryOnboarding(null)).toBe(false);
    expect(hasCompletedStoryOnboarding(user())).toBe(false);
  });

  it("reads completion from user_metadata", () => {
    const u = user({
      [STORY_META.completedAt]: "2026-02-01T00:00:00.000Z",
    });
    expect(hasCompletedStoryOnboarding(u)).toBe(true);
  });

  it("suggests a channel name from work email domains", () => {
    expect(suggestChannelName("alex@northwind.com")).toBe("Northwind insights");
    expect(suggestChannelName("me@gmail.com")).toBe("Team research");
    expect(suggestChannelName(undefined)).toBe("Team research");
  });

  it("starts with a default channel name and no role", () => {
    expect(emptyStorySession()).toEqual({ channelName: "Team research" });
  });
});
