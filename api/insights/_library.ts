import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryInsight } from "../../src/lib/research-search.js";

/** Most insights one workspace search reads. Far above typical use; keeps a runaway workspace bounded. */
export const LIBRARY_LIMIT = 2000;

/**
 * Loads the insights a member may see: everything for editors, published studies
 * only for viewers. Returns null when the user isn't in the workspace.
 */
export async function loadLibrary(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<{ role: string; insights: LibraryInsight[] } | null> {
  const { data: member } = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  let query = client
    .from("reels")
    .select("id, title, track, topics, scenes, studies!inner(title, status)")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(LIBRARY_LIMIT);
  if (member.role === "member") query = query.eq("studies.status", "published");
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const insights = (data ?? []).map((row) => {
    const study = Array.isArray(row.studies) ? row.studies[0] : row.studies;
    return {
      id: String(row.id),
      title: String(row.title ?? ""),
      track: String(row.track ?? ""),
      studyTitle: String((study as { title?: string } | null)?.title ?? ""),
      topics: Array.isArray(row.topics) ? (row.topics as string[]) : [],
      scenes: Array.isArray(row.scenes) ? row.scenes : [],
    } satisfies LibraryInsight;
  });
  return { role: member.role, insights };
}

export function readBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
