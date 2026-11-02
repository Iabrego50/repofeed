import { supabase } from "../supabase";
import { canCreateShareLink, effectiveRole } from "./access";
import { mapReel } from "./mappers";
import type { Role } from "@/schema";

export function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function generateGuestSecret(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function normalizeGuestName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function isShareLinkLive(link: { revoked: boolean; expires_at?: string | null } | null): boolean {
  if (!link || link.revoked) return false;
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return false;
  return true;
}

export function filterCommentsForGuest<T extends { guest_id?: string | null; user_id?: string | null }>(
  comments: T[],
  hideTeamComments: boolean,
): T[] {
  if (!hideTeamComments) return comments;
  return comments.filter((c) => c.guest_id != null);
}

export function guestVisibleCommentCount(teamComments: number, guestComments: number, hideTeamComments: boolean): number {
  return hideTeamComments ? guestComments : teamComments + guestComments;
}

async function requireEditor(workspaceId: string): Promise<{ userId: string; role: Role }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("seat_overage")
    .eq("id", workspaceId)
    .maybeSingle();

  const role = membership ? effectiveRole(membership.role as Role, workspace?.seat_overage) : null;
  if (!role || !canCreateShareLink(role)) {
    throw new Error("Only workspace editors can do this");
  }
  return { userId: user.id, role };
}

export async function createShareLink(args: { studyId: string }): Promise<string> {
  const { data: study } = await supabase
    .from("studies")
    .select("id, workspace_id, status")
    .eq("id", args.studyId)
    .maybeSingle();

  if (!study) throw new Error("Study not found");
  await requireEditor(study.workspace_id);

  const { data: existing } = await supabase
    .from("share_links")
    .select("token, revoked")
    .eq("study_id", args.studyId)
    .eq("revoked", false)
    .maybeSingle();

  if (existing?.token) return existing.token;

  const token = generateShareToken();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("share_links").insert({
    study_id: args.studyId,
    workspace_id: study.workspace_id,
    token,
    created_by: user!.id,
    revoked: false,
    hide_team_comments: true,
  });
  if (error) throw error;
  return token;
}

export async function revokeShareLink(args: { studyId: string }): Promise<void> {
  const { data: study } = await supabase
    .from("studies")
    .select("workspace_id")
    .eq("id", args.studyId)
    .maybeSingle();
  if (!study) throw new Error("Study not found");
  await requireEditor(study.workspace_id);

  const { error } = await supabase
    .from("share_links")
    .update({ revoked: true })
    .eq("study_id", args.studyId)
    .eq("revoked", false);
  if (error) throw error;
}

export async function loadShare(token: string) {
  const { data: link } = await supabase
    .from("share_links")
    .select("id, study_id, workspace_id, token, revoked, hide_team_comments")
    .eq("token", token)
    .maybeSingle();

  if (!isShareLinkLive(link)) return null;

  const { data: study } = await supabase
    .from("studies")
    .select("id, title, status")
    .eq("id", link!.study_id)
    .maybeSingle();

  if (!study || study.status !== "published") return null;
  return { link: link!, study };
}

export async function requireShare(token: string) {
  const share = await loadShare(token);
  if (!share) throw new Error("This link is no longer available");
  return share;
}

export async function requireShareReel(studyId: string, reelId: string) {
  const { data: reel } = await supabase
    .from("reels")
    .select("id, study_id, enabled")
    .eq("id", reelId)
    .maybeSingle();
  if (!reel || reel.study_id !== studyId || !reel.enabled) {
    throw new Error("Scene not found");
  }
  return reel;
}

export async function requireGuest(token: string, secret: string) {
  const share = await requireShare(token);
  const { data: guest } = await supabase
    .from("guests")
    .select("id, name, secret, study_id, link_id")
    .eq("link_id", share.link.id)
    .eq("secret", secret)
    .maybeSingle();
  if (!guest || guest.study_id !== share.study.id) {
    throw new Error("Tell us your name to join in");
  }
  return { ...share, guest };
}

export async function shareFeed(args: { token: string; secret?: string }) {
  const share = await loadShare(args.token);
  if (!share) return null;

  const { data: reels } = await supabase
    .from("reels")
    .select("*, studies!inner(title)")
    .eq("study_id", share.study.id)
    .eq("enabled", true);

  let guest = null;
  if (args.secret) {
    const { data: guestData } = await supabase
      .from("guests")
      .select("*")
      .eq("link_id", share.link.id)
      .eq("secret", args.secret)
      .maybeSingle();
    guest = guestData
      ? { ...guestData, name: normalizeGuestName(guestData.name) }
      : null;
  }

  return {
    studyTitle: share.study.title || "Untitled Study",
    reels: (reels || []).map(mapReel),
    guest,
    hideTeamComments: share.link.hide_team_comments,
  };
}

export async function joinShare(args: { token: string; name: string }) {
  const share = await requireShare(args.token);
  const secret = generateGuestSecret();
  const { data: guest, error } = await supabase
    .from("guests")
    .insert({
      study_id: share.study.id,
      link_id: share.link.id,
      name: normalizeGuestName(args.name),
      secret,
    })
    .select()
    .single();
  if (error) throw error;
  return { secret, guestId: guest?.id as string | undefined };
}

export async function publicTokenForReel(args: { reelId: string }): Promise<string | null> {
  const { data: reel } = await supabase
    .from("reels")
    .select("study_id, enabled")
    .eq("id", args.reelId)
    .maybeSingle();

  if (!reel || !reel.enabled) return null;

  const { data: study } = await supabase
    .from("studies")
    .select("id, status")
    .eq("id", reel.study_id)
    .maybeSingle();

  if (!study || study.status !== "published") return null;

  const { data: shareLink } = await supabase
    .from("share_links")
    .select("token")
    .eq("study_id", study.id)
    .eq("revoked", false)
    .maybeSingle();

  return shareLink?.token ?? null;
}

export async function reelShareLink(args: { reelId: string }): Promise<string> {
  const { data: reel } = await supabase
    .from("reels")
    .select("study_id, workspace_id")
    .eq("id", args.reelId)
    .maybeSingle();
  if (!reel) throw new Error("Scene not found");
  await requireEditor(reel.workspace_id);
  return createShareLink({ studyId: reel.study_id });
}

export async function shareComments(args: { token: string; reelId: string; secret?: string }) {
  const share = await requireShare(args.token);
  await requireShareReel(share.study.id, args.reelId);

  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("reel_id", args.reelId)
    .order("created_at", { ascending: true });

  return filterCommentsForGuest(data || [], share.link.hide_team_comments ?? true);
}

export async function shareEvidence(args: { token: string; reelId: string }) {
  const share = await requireShare(args.token);
  await requireShareReel(share.study.id, args.reelId);
  const { data: reel } = await supabase
    .from("reels")
    .select("finding_ids")
    .eq("id", args.reelId)
    .maybeSingle();
  return reel?.finding_ids ?? [];
}
