import type { Role } from "@/schema";

/** Workspace creators who may use Insights, decks, and demo research tools. */
export function isResearcherRole(role: Role | string | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

/**
 * True when the signed-in user may see researcher-only CTAs/routes:
 * workspace owner/editor, or product admin (`users.is_admin`).
 * Signed-out visitors and viewer (`member`) roles are not researchers.
 */
export function isResearcherAccount(args: {
  signedIn: boolean;
  workspaceRole?: Role | string | null;
  isAdmin?: boolean | null;
}): boolean {
  if (!args.signedIn) return false;
  if (args.isAdmin === true) return true;
  return isResearcherRole(args.workspaceRole);
}
