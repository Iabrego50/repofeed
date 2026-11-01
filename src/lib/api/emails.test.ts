import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeSupabase } from "../test/fake-supabase";

const bag = vi.hoisted(() => ({ fake: null as FakeSupabase | null }));
const resendSend = vi.hoisted(() => vi.fn());

async function supabaseMock() {
  const { createFakeSupabase } = await import("../test/fake-supabase");
  if (!bag.fake) bag.fake = createFakeSupabase();
  return { supabase: bag.fake.client };
}
vi.mock("../supabase", supabaseMock);
vi.mock("@/lib/supabase", supabaseMock);
vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: resendSend };
  },
}));

function fake(): FakeSupabase {
  if (!bag.fake) throw new Error("fake supabase not initialized");
  return bag.fake;
}

import { getEmailPrefs, setEmailPrefs } from "./email-prefs";
import {
  defaultEmailPrefs,
  feedbackKindLabel,
  isFirstPublish,
  settingsUrl,
  shouldSendFeedback,
  shouldSendStudyPublished,
} from "./email-notify";
import { sendFeedbackEmail, sendStudyPublishedEmail } from "../../../api/_lib/emails";

describe("email notifications", () => {
  beforeEach(() => {
    fake().reset();
    resendSend.mockReset();
    fake().setUser({ id: "owner-1", email: "owner@example.com" });
  });

  it("email preferences default to enabled", async () => {
    expect(defaultEmailPrefs()).toEqual({ newStudies: true, feedback: true });
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("users", { data: { email: "owner@example.com" } });
    fake().queue("email_prefs", { data: null });
    expect(await getEmailPrefs("ws1")).toEqual({
      email: "owner@example.com",
      newStudies: true,
      feedback: true,
    });
  });

  it("email prefs are per-user per-workspace", async () => {
    fake().queue("workspace_members", { data: { role: "owner" } });
    fake().queue("email_prefs", { data: { new_studies: true, feedback: false } });
    await setEmailPrefs({ workspaceId: "ws1", feedback: false });
    expect(fake().lastCall("email_prefs", "update")?.payload).toEqual({
      new_studies: true,
      feedback: false,
    });
    expect(fake().filterEq(fake().lastCall("email_prefs", "update")!, "user_id")).toBe("owner-1");
    expect(fake().filterEq(fake().lastCall("email_prefs", "update")!, "workspace_id")).toBe("ws1");

    const owner = { newStudies: false, feedback: false };
    const member = { newStudies: true, feedback: true };
    expect(shouldSendFeedback({ prefs: owner, recipientEmail: "owner@example.com" })).toBe(false);
    expect(shouldSendFeedback({ prefs: member, recipientEmail: "member@example.com" })).toBe(true);
  });

  it("study publish email sent only on first publish and never to the publisher", async () => {
    expect(isFirstPublish(null)).toBe(true);
    expect(isFirstPublish("2024-01-01")).toBe(false);

    fake().queue("workspace_members", {
      data: [
        { user_id: "owner-1", users: { email: "owner@example.com" } },
        { user_id: "member-1", users: { email: "member@example.com" } },
      ],
    });
    fake().queue("email_prefs", { data: { new_studies: true, feedback: true } });
    fake().queue("email_prefs", { data: { new_studies: true, feedback: true } });
    await sendStudyPublishedEmail({
      workspaceId: "ws1",
      studyId: "s1",
      studyTitle: "Onboarding",
      authorName: "Olivia",
      publisherUserId: "owner-1",
      publishedAt: null,
    });
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(resendSend.mock.calls[0][0]).toEqual(expect.objectContaining({
      to: "member@example.com",
      subject: "Olivia published Onboarding",
    }));
    expect(String(resendSend.mock.calls[0][0].html)).toContain("/feed?study=s1");

    resendSend.mockClear();
    await sendStudyPublishedEmail({
      workspaceId: "ws1",
      studyId: "s1",
      studyTitle: "Onboarding",
      authorName: "Olivia",
      publisherUserId: "owner-1",
      publishedAt: "2024-01-01",
    });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("feedback email types map correctly and respect the feedback switch", async () => {
    expect(feedbackKindLabel("question")).toBe("asked a question");
    expect(feedbackKindLabel("pushback")).toBe("pushed back");
    expect(feedbackKindLabel("note")).toBe("left a note");

    fake().queue("users", { data: { email: "owner@example.com" } });
    fake().queue("email_prefs", { data: { new_studies: true, feedback: false } });
    await sendFeedbackEmail({
      workspaceId: "ws1",
      reelId: "r1",
      reelTitle: "Scene",
      commenterName: "Marco",
      commentKind: "pushback",
      commentBody: "No",
      recipientUserId: "owner-1",
    });
    expect(resendSend).not.toHaveBeenCalled();

    fake().queue("users", { data: { email: "owner@example.com" } });
    fake().queue("email_prefs", { data: { new_studies: true, feedback: true } });
    await sendFeedbackEmail({
      workspaceId: "ws1",
      reelId: "r1",
      reelTitle: "Scene",
      commenterName: "Marco",
      commentKind: "pushback",
      commentBody: "No",
      recipientUserId: "owner-1",
    });
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.com",
      subject: "Marco pushed back",
    }));
  });

  it("email template includes workspace settings link", () => {
    expect(settingsUrl("https://repofeed.ai", "ws-123")).toBe("https://repofeed.ai/settings?ws=ws-123");
  });

  it("shouldSendStudyPublished skips missing emails and the author", () => {
    const prefs = defaultEmailPrefs();
    expect(shouldSendStudyPublished({
      prefs,
      recipientUserId: "owner-1",
      publisherUserId: "owner-1",
      recipientEmail: "owner@example.com",
    })).toBe(false);
    expect(shouldSendStudyPublished({
      prefs: { newStudies: false, feedback: true },
      recipientUserId: "m1",
      publisherUserId: "owner-1",
      recipientEmail: "m@test.com",
    })).toBe(false);
  });
});
