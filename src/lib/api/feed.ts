import { supabase } from '../supabase';

export async function listReels(args: { workspaceId: string; studyId?: string }) {
  let query = supabase
    .from('reels')
    .select(`
      *,
      study:studies!reels_study_id_fkey(id, title, workspace_id),
      reactions:reactions(id, type, user_id),
      views:reel_views(id, user_id, viewed_at),
      counters:reel_counters(reel_id, views_count, reactions_count, comments_count)
    `)
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false });

  if (args.studyId) {
    query = query.eq('study_id', args.studyId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    _id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    studyId: row.study_id,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }));
}

export async function searchReels(args: { workspaceId: string; query: string }) {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .or(`title.ilike.%${args.query}%,text.ilike.%${args.query}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    _id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    studyId: row.study_id,
  }));
}

export async function saveReel(args: {
  reelId: string;
  userId: string;
  workspaceId: string;
  studyId: string;
}) {
  const { error } = await supabase
    .from('saved_reels')
    .insert({
      reel_id: args.reelId,
      user_id: args.userId,
      workspace_id: args.workspaceId,
      study_id: args.studyId,
    });

  if (error) throw error;
}

export async function unsaveReel(args: { reelId: string; userId: string }) {
  const { error } = await supabase
    .from('saved_reels')
    .delete()
    .eq('reel_id', args.reelId)
    .eq('user_id', args.userId);

  if (error) throw error;
}

export async function listSavedReels(args: { workspaceId: string; userId: string }) {
  const { data, error } = await supabase
    .from('saved_reels')
    .select(`
      *,
      reel:reels!saved_reels_reel_id_fkey(*)
    `)
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row.reel,
    _id: row.reel.id,
    _creationTime: new Date(row.reel.created_at).getTime(),
    savedAt: row.saved_at,
  }));
}
