import { supabase } from "../supabase";

export async function listUnreadStudyIds(args: { workspaceId: string }): Promise<string[]> {
  const { data, error } = await supabase.rpc("unread_study_ids", {
    p_workspace_id: args.workspaceId,
  });
  if (error) throw error;
  if (!data) return [];
  if (Array.isArray(data)) return data.map(String);
  return [];
}

export async function markStudySeen(args: { studyId: string }): Promise<void> {
  const { error } = await supabase.rpc("mark_study_seen", {
    p_study_id: args.studyId,
  });
  if (error) throw error;
}
