import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  emptyStorySession,
  GUEST_STORY_DONE_KEY,
  hasCompletedGuestStory,
  hasCompletedStoryOnboarding,
  hasCompletedViewerOnboarding,
  markGuestStoryComplete,
  markViewerOnboardingComplete,
  PENDING_PLAN_KEY,
  setPendingPlan,
  shouldShowWebStory,
  STORY_META,
  suggestChannelName,
  takePendingPlan,
  VIEWER_ONBOARDING_DONE_KEY,
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
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

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

  it("shows the web story for new guests and hides it after local completion", () => {
    expect(shouldShowWebStory(null)).toBe(true);
    expect(hasCompletedGuestStory()).toBe(false);
    markGuestStoryComplete();
    expect(localStorage.getItem(GUEST_STORY_DONE_KEY)).toBe("1");
    expect(shouldShowWebStory(null)).toBe(false);
  });

  it("does not show the web story for signed-in users who finished it", () => {
    expect(shouldShowWebStory(user())).toBe(true);
    expect(
      shouldShowWebStory(
        user({ [STORY_META.completedAt]: "2026-02-01T00:00:00.000Z" }),
      ),
    ).toBe(false);
  });

  it("tracks native viewer onboarding separately", () => {
    expect(hasCompletedViewerOnboarding()).toBe(false);
    markViewerOnboardingComplete();
    expect(localStorage.getItem(VIEWER_ONBOARDING_DONE_KEY)).toBe("1");
    expect(hasCompletedViewerOnboarding()).toBe(true);
  });

  it("stores and consumes a pending paid plan for Stripe checkout", () => {
    setPendingPlan({ plan: "pro", interval: "year" });
    expect(sessionStorage.getItem(PENDING_PLAN_KEY)).toBeTruthy();
    expect(takePendingPlan()).toEqual({ plan: "pro", interval: "year" });
    expect(takePendingPlan()).toBeNull();
  });

  it("suggests a channel name from work email domains", () => {
    expect(suggestChannelName("alex@northwind.com")).toBe("Northwind insights");
    expect(suggestChannelName("me@gmail.com")).toBe("Team research");
    expect(suggestChannelName(undefined)).toBe("Team research");
  });

  it("starts with a default channel name and no role", () => {
    expect(emptyStorySession()).toEqual({ channelName: "Team research", researchKinds: [] });
  });
});
