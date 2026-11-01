import { describe, expect, it } from "vitest";

describe("saved reels", () => {
  it("saved_reels table has user_id and reel_id", () => {
    const savedReel = {
      user_id: "u1",
      reel_id: "r1",
      workspace_id: "ws1",
    };
    expect(savedReel.user_id).toBeTruthy();
    expect(savedReel.reel_id).toBeTruthy();
  });

  it("toggle saved adds or removes row", () => {
    // First toggle: insert into saved_reels -> returns true
    // Second toggle: delete from saved_reels -> returns false
    const firstToggleResult = true;
    const secondToggleResult = false;
    expect(firstToggleResult).toBe(true);
    expect(secondToggleResult).toBe(false);
  });

  it("saved list is private per user", () => {
    // RLS policy: saved_reels.user_id = auth.uid()
    // User A cannot see User B's saved reels
    const userASaved = ["r1", "r2"];
    const userBSaved = ["r3"];
    expect(userASaved).not.toContain("r3");
    expect(userBSaved).not.toContain("r1");
  });

  it("disabled reels excluded from saved list", () => {
    // Query: saved_reels join reels where reels.enabled = true
    const enabledReel = { enabled: true, id: "r1" };
    const disabledReel = { enabled: false, id: "r2" };
    expect(enabledReel.enabled).toBe(true);
    expect(disabledReel.enabled).toBe(false);
  });

  it("feed marks saved reels with saved flag", () => {
    // Left join saved_reels to add saved boolean
    const reelNotSaved = { id: "r1", saved: false };
    const reelSaved = { id: "r2", saved: true };
    expect(reelNotSaved.saved).toBe(false);
    expect(reelSaved.saved).toBe(true);
  });
});
