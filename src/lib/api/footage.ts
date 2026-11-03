import { supabase } from "../supabase";
import { STOCK_CLIPS } from "../reel/stock-clips";
import { canCreateShareLink, effectiveRole } from "./access";
import type { Role } from "@/schema";

export { STOCK_CLIPS };

export type FootageSource =
  { kind: "stock"; url: string } | { kind: "upload"; clipId: string };

export type ReelFootage = {
  caption: string;
  source: FootageSource;
  url?: string;
} | null;

export function isStockClip(url: string): boolean {
  return STOCK_CLIPS.some((c) => c.url === url);
}

export function normalizeFootageCaption(caption: string): string {
  return caption.trim().slice(0, 160);
}

export function validateFootage(
  footage: Exclude<ReelFootage, null>,
): Exclude<ReelFootage, null> {
  if (footage.source.kind === "stock" && !isStockClip(footage.source.url)) {
    throw new Error("Only built-in stock clips can be used");
  }
  return {
    ...footage,
    caption: normalizeFootageCaption(footage.caption),
    url: footage.source.kind === "stock" ? footage.source.url : footage.url,
  };
}

async function requireEditor(workspaceId: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const role = membership
    ? effectiveRole(membership.role as Role, workspace?.seat_overage)
    : null;
  if (!role || !canCreateShareLink(role)) {
    throw new Error("Only workspace editors can do this");
  }
  return user.id;
}

export async function listLibrary(args: { workspaceId: string }) {
  await requireEditor(args.workspaceId);
  const { data, error } = await supabase
    .from("footage_clips")
    .select("id, storage_id, name, size, url")
    .eq("workspace_id", args.workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { uploads: data || [], stock: STOCK_CLIPS };
}

export async function saveUpload(args: {
  workspaceId: string;
  storageId: string;
  name: string;
  size?: number;
}): Promise<string> {
  const userId = await requireEditor(args.workspaceId);

  const { data: claimed } = await supabase
    .from("upload_claims")
    .select("id, workspace_id")
    .eq("storage_id", args.storageId)
    .maybeSingle();

  if (claimed && claimed.workspace_id !== args.workspaceId) {
    throw new Error("This upload belongs to another workspace");
  }

  if (!claimed) {
    const { error: claimError } = await supabase.from("upload_claims").insert({
      storage_id: args.storageId,
      workspace_id: args.workspaceId,
    });
    if (claimError) throw claimError;
  }

  const { data, error } = await supabase
    .from("footage_clips")
    .insert({
      workspace_id: args.workspaceId,
      storage_id: args.storageId,
      // Footage lives in the private `footage` bucket. Store the object path,
      // never a /object/public URL (those 400 on private buckets).
      url: args.storageId,
      name: args.name.slice(0, 200),
      size: args.size ?? 0,
      uploaded_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function setReelFootage(args: {
  reelId: string;
  footage: ReelFootage;
}) {
  const { data: reel } = await supabase
    .from("reels")
    .select("id, workspace_id")
    .eq("id", args.reelId)
    .maybeSingle();
  if (!reel) throw new Error("Reel not found");
  await requireEditor(reel.workspace_id);

  const next = args.footage ? validateFootage(args.footage) : null;
  const { error } = await supabase
    .from("reels")
    .update({
      footage: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.reelId);
  if (error) throw error;
  return next;
}

export async function removeUpload(args: {
  clipId: string;
}): Promise<{ cleared: number }> {
  const { data: clip } = await supabase
    .from("footage_clips")
    .select("id, workspace_id, storage_id")
    .eq("id", args.clipId)
    .maybeSingle();
  if (!clip) throw new Error("Clip not found");
  await requireEditor(clip.workspace_id);

  const { data: reels } = await supabase
    .from("reels")
    .select("id, footage")
    .eq("workspace_id", clip.workspace_id);

  const affected = (reels || []).filter((r) => {
    const footage = r.footage as { source?: { clipId?: string } } | null;
    return footage?.source?.clipId === args.clipId;
  });

  for (const reel of affected) {
    const { error } = await supabase
      .from("reels")
      .update({ footage: null, updated_at: new Date().toISOString() })
      .eq("id", reel.id);
    if (error) throw error;
  }

  const { error: deleteError } = await supabase
    .from("footage_clips")
    .delete()
    .eq("id", args.clipId);
  if (deleteError) throw deleteError;

  if (clip.storage_id) {
    const { error: storageError } = await supabase.storage
      .from("footage")
      .remove([clip.storage_id]);
    if (storageError) {
      console.error("Failed to remove footage object:", storageError);
    }
  }

  return { cleared: affected.length };
}
