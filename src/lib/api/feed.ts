import { supabase } from '../supabase';

export async function listReels(args: { workspaceId: string; studyId?: string }) {
  let query = supabase
    .from('reels')
    .select('*')
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
    .select('reel_id, created_at')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Get the actual reels
  const { data: reels } = await supabase
    .from('reels')
    .select('*')
    .in('id', data.map(s => s.reel_id));

  if (!reels) return [];

  // Create a map of savedAt times
  const savedAtMap = new Map(data.map(s => [s.reel_id, s.created_at]));

  return reels.map((reel) => ({
    ...reel,
    _id: reel.id,
    _creationTime: new Date(reel.created_at).getTime(),
    savedAt: savedAtMap.get(reel.id),
  }));
}
