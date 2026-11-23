import { describe, expect, it } from "vitest";
import { isResearcherAccount, isResearcherRole } from "./researcher";

describe("isResearcherRole", () => {
  it("treats owners and editors as researchers", () => {
    expect(isResearcherRole("owner")).toBe(true);
    expect(isResearcherRole("editor")).toBe(true);
    expect(isResearcherRole("member")).toBe(false);
    expect(isResearcherRole(null)).toBe(false);
  });
});

describe("isResearcherAccount", () => {
  it("requires a signed-in user", () => {
    expect(isResearcherAccount({ signedIn: false, workspaceRole: "owner" })).toBe(false);
    expect(isResearcherAccount({ signedIn: false, isAdmin: true })).toBe(false);
  });

  it("allows editors/owners and product admins", () => {
    expect(isResearcherAccount({ signedIn: true, workspaceRole: "editor" })).toBe(true);
    expect(isResearcherAccount({ signedIn: true, workspaceRole: "owner" })).toBe(true);
    expect(isResearcherAccount({ signedIn: true, workspaceRole: "member", isAdmin: true })).toBe(true);
  });

  it("blocks viewer/member accounts and signed-out visitors", () => {
    expect(isResearcherAccount({ signedIn: true, workspaceRole: "member" })).toBe(false);
    expect(isResearcherAccount({ signedIn: true, workspaceRole: null })).toBe(false);
  });
});
