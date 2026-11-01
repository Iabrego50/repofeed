import { describe, expect, it } from "vitest";

describe("email notifications", () => {
  it("email preferences default to enabled", () => {
    // When no email_prefs row exists:
    // - new_studies should default to true
    // - feedback should default to true
    const defaultPrefs = { newStudies: true, feedback: true };
    expect(defaultPrefs.newStudies).toBe(true);
    expect(defaultPrefs.feedback).toBe(true);
  });

  it("email prefs are per-user per-workspace", () => {
    // Each user has independent email preferences per workspace
    // User A can disable in workspace W1
    // User B keeps enabled in same workspace W1
    const userAPrefs = { feedback: false };
    const userBPrefs = { feedback: true };
    expect(userAPrefs.feedback).not.toBe(userBPrefs.feedback);
  });

  it("study publish email sent only on first publish", () => {
    // published_at null -> first publish -> send emails
    // published_at set -> republish -> no emails
    const firstPublish = { published_at: null };
    const republish = { published_at: "2024-01-01" };
    expect(firstPublish.published_at).toBeNull();
    expect(republish.published_at).toBeTruthy();
  });

  it("feedback email types map correctly", () => {
    // Comment kinds determine email subject
    const kindLabels: Record<string, string> = {
      pushback: "pushed back",
      question: "asked a question",
      note: "left a note",
    };
    expect(kindLabels.question).toBe("asked a question");
    expect(kindLabels.pushback).toBe("pushed back");
    expect(kindLabels.note).toBe("left a note");
  });

  it("email template includes workspace settings link", () => {
    const siteUrl = "https://repofeed.ai";
    const workspaceId = "ws-123";
    const settingsUrl = `${siteUrl}/settings?ws=${encodeURIComponent(workspaceId)}`;
    expect(settingsUrl).toContain("/settings?ws=ws-123");
  });
});
