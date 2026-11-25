import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  emptyStoryAnswers,
  hasCompletedStoryOnboarding,
  readStoryAnswers,
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

  it("reads completion and answers from user_metadata", () => {
    const u = user({
      [STORY_META.completedAt]: "2026-02-01T00:00:00.000Z",
      [STORY_META.role]: "researcher",
      [STORY_META.researchKinds]: ["interviews", "surveys"],
      [STORY_META.shareAudience]: "my_team",
      [STORY_META.channelName]: "Northwind insights",
    });
    expect(hasCompletedStoryOnboarding(u)).toBe(true);
    expect(readStoryAnswers(u)).toEqual({
      role: "researcher",
      researchKinds: ["interviews", "surveys"],
      shareAudience: "my_team",
      channelName: "Northwind insights",
    });
  });

  it("ignores unknown research kinds and roles", () => {
    expect(
      readStoryAnswers(
        user({
          [STORY_META.role]: "astronaut",
          [STORY_META.researchKinds]: ["interviews", "telepathy"],
          [STORY_META.shareAudience]: "aliens",
        }),
      ),
    ).toEqual({
      role: undefined,
      researchKinds: ["interviews"],
      shareAudience: undefined,
      channelName: "",
    });
  });

  it("suggests a channel name from work email domains", () => {
    expect(suggestChannelName("alex@northwind.com")).toBe("Northwind insights");
    expect(suggestChannelName("me@gmail.com")).toBe("Team research");
    expect(suggestChannelName(undefined)).toBe("Team research");
  });

  it("starts with empty answers", () => {
    expect(emptyStoryAnswers()).toEqual({ researchKinds: [], channelName: "" });
  });
});
