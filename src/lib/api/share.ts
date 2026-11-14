import { supabase } from "../supabase";
import { canCreateShareLink, effectiveRole } from "./access";
import { mapComment, mapFinding, mapReel, type DbComment, type DbFinding, type DbReel } from "./mappers";
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

type ShareLoadRow = {
  link: {
    id: string;
    study_id: string;
    workspace_id: string;
    token: string;
    revoked: boolean;
    hide_team_comments: boolean;
    expires_at?: string | null;
  };
  study: { id: string; title: string; status: string };
};

async function rpcJson<T>(fn: keyof import("../database.types").Database["public"]["Functions"], args: object): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) throw error;
  return data as T;
}

export async function loadShare(token: string) {
  const data = await rpcJson<ShareLoadRow | null>("share_load", { p_token: token });
  if (!data?.link || !data.study) return null;
  if (!isShareLinkLive(data.link)) return null;
  if (data.study.status !== "published") return null;
  return data;
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
  const feed = await shareFeed({ token, secret });
  if (!feed?.guest) {
    throw new Error("Tell us your name to join in");
  }
  return { ...share, guest: feed.guest };
}

export async function shareFeed(args: { token: string; secret?: string }) {
  const data = await rpcJson<{
    studyTitle: string;
    hideTeamComments: boolean;
    guest: { id: string; name: string; study_id: string; link_id: string } | null;
    reels: DbReel[];
  } | null>("share_feed", {
    p_token: args.token,
    p_secret: args.secret ?? null,
  });
  if (!data) return null;

  return {
    studyTitle: data.studyTitle || "Untitled Study",
    reels: (data.reels || []).map(mapReel),
    guest: data.guest
      ? { ...data.guest, name: normalizeGuestName(data.guest.name) }
      : null,
    hideTeamComments: data.hideTeamComments ?? true,
  };
}

export async function joinShare(args: { token: string; name: string }) {
  const data = await rpcJson<{ secret: string; guestId: string }>("share_join", {
    p_token: args.token,
    p_name: normalizeGuestName(args.name),
  });
  return { secret: data.secret, guestId: data.guestId };
}

export async function publicTokenForReel(args: { reelId: string }): Promise<string | null> {
  const token = await rpcJson<string | null>("share_public_token", {
    p_reel_id: args.reelId,
  });
  return token ?? null;
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
  const rows = await rpcJson<DbComment[]>("share_comments", {
    p_token: args.token,
    p_reel_id: args.reelId,
  });
  return (rows || []).map(mapComment);
}

export async function shareEvidence(args: { token: string; reelId: string }) {
  const rows = await rpcJson<DbFinding[]>("share_evidence", {
    p_token: args.token,
    p_reel_id: args.reelId,
  });
  return (rows || []).map(mapFinding);
}
