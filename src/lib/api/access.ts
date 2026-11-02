import type { Plan, Role, StudyStatus } from "@/schema";

const ROLE_RANK: Record<Role, number> = { member: 1, editor: 2, owner: 3 };

export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isSeatRestricted(seatOverage: boolean | null | undefined, role: Role): boolean {
  return Boolean(seatOverage) && role === "editor";
}

/** Editors paused by a plan downgrade act as members until seats are restored. */
export function effectiveRole(role: Role, seatOverage: boolean | null | undefined): Role {
  return isSeatRestricted(seatOverage, role) ? "member" : role;
}

export function canSeeStudy(status: StudyStatus | string, role: Role): boolean {
  return hasRole(role, "editor") || status === "published";
}

export function canCreateEditorInvite(role: Role): boolean {
  return role === "owner";
}

export function canCreateShareLink(role: Role): boolean {
  return hasRole(role, "editor");
}

export function canDeleteComment(role: Role, isOwn: boolean): boolean {
  return isOwn || hasRole(role, "editor");
}

export function canRemoveMember(actorRole: Role, targetRole: Role, isSelf: boolean, ownerCount: number): void {
  if (actorRole !== "owner") {
    throw new Error("Must be workspace owner");
  }
  if (isSelf || (targetRole === "owner" && ownerCount <= 1)) {
    throw new Error("The last owner cannot be removed or demoted");
  }
}

export function canSetMemberRole(actorRole: Role, targetRole: Role, nextRole: Role, ownerCount: number): void {
  if (actorRole !== "owner") {
    throw new Error("Must be workspace owner");
  }
  if (targetRole === "owner" && nextRole !== "owner" && ownerCount <= 1) {
    throw new Error("The last owner cannot be removed or demoted");
  }
}

export function memberEmailsVisible(viewerRole: Role): boolean {
  return hasRole(viewerRole, "editor");
}

export function redactMemberEmail(email: string | null | undefined, viewerRole: Role): string | undefined {
  return memberEmailsVisible(viewerRole) ? email ?? undefined : undefined;
}

export function inviteIsUsable(invite: {
  revoked: boolean;
  expires_at: string;
  max_uses: number | null;
  uses: number;
}): "ok" | "invalid" | "expired" | "used up" {
  if (invite.revoked) return "invalid";
  if (new Date(invite.expires_at) < new Date()) return "expired";
  if (invite.max_uses != null && invite.uses >= invite.max_uses) return "used up";
  return "ok";
}

export function workspaceCreateDailyLimit(): number {
  return 5;
}

export function assertWorkspaceCreateAllowed(createdToday: number): void {
  if (createdToday >= workspaceCreateDailyLimit()) {
    throw new Error("You can create more workspaces tomorrow");
  }
}

export function assertEditorInviteAllowed(plan: Plan, role: "editor" | "member"): void {
  if (role === "editor" && plan !== "team") {
    throw new Error("Adding more editors needs the Team plan. Members who watch and discuss are always free.");
  }
}
