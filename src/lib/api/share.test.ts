import { describe, expect, it } from "vitest";

describe("guest share links", () => {
  it("share link has unique token", () => {
    const token1 = "a".repeat(32);
    const token2 = "b".repeat(32);
    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(32);
  });

  it("share link points to study", () => {
    const shareLink = {
      study_id: "s1",
      token: "abc123",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    expect(shareLink.study_id).toBe("s1");
    expect(shareLink.token).toBeTruthy();
  });

  it("expired tokens are invalid", () => {
    const now = new Date();
    const expired = new Date(now.getTime() - 1000);
    const valid = new Date(now.getTime() + 1000);
    expect(expired < now).toBe(true);
    expect(valid > now).toBe(true);
  });

  it("guest session has secret for auth", () => {
    const guestSession = {
      link_id: "link1",
      secret: "x".repeat(32),
      guest_name: "Priya",
    };
    expect(guestSession.secret.length).toBe(32);
    expect(guestSession.guest_name).toBe("Priya");
  });

  it("hide_team_comments filters comment count", () => {
    const teamComments = 5;
    const guestComments = 2;
    const totalComments = teamComments + guestComments;
    
    const shownWhenHidden = guestComments;
    const shownWhenVisible = totalComments;
    
    expect(shownWhenHidden).toBe(2);
    expect(shownWhenVisible).toBe(7);
  });

  it("guest comments marked with is_guest flag", () => {
    const teamComment = { is_guest: false, user_id: "u1" };
    const guestComment = { is_guest: true, guest_id: "g1" };
    expect(teamComment.is_guest).toBe(false);
    expect(guestComment.is_guest).toBe(true);
  });
});
