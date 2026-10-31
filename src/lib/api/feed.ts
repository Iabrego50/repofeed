import { supabase } from '../supabase';

export async function listReels(args: { workspaceId: string; studyId?: string }): Promise<any[]> {
  let query = supabase
    .from('reels')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .eq('enabled', true)
    .order('position', { ascending: true });

  if (args.studyId) {
    query = query.eq('study_id', args.studyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map((reel: any) => ({
    ...reel,
    _id: reel.id,
    _creationTime: new Date(reel.created_at).getTime(),
    studyId: reel.study_id,
    workspaceId: reel.workspace_id,
    findingIds: reel.finding_ids,
    sourceNames: reel.source_names,
    trackIndex: reel.track_index,
  }));
}

export async function listSavedReels(args: { workspaceId: string; userId: string }): Promise<any[]> {
  const { data, error } = await supabase
    .from('saved_reels')
    .select(`
      reel_id,
      reels (*)
    `)
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId);

  if (error) throw error;
  
  return (data || []).map((saved: any) => ({
    ...saved.reels,
    _id: saved.reels.id,
    _creationTime: new Date(saved.reels.created_at).getTime(),
    studyId: saved.reels.study_id,
    workspaceId: saved.reels.workspace_id,
    findingIds: saved.reels.finding_ids,
    sourceNames: saved.reels.source_names,
    trackIndex: saved.reels.track_index,
  }));
}

export async function saveReel(args: { reelId: string; workspaceId: string; studyId: string; userId: string }) {
  const { error } = await supabase
    .from('saved_reels')
    .upsert({
      reel_id: args.reelId,
      workspace_id: args.workspaceId,
      study_id: args.studyId,
      user_id: args.userId,
    } as any);

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

export async function searchReels(args: { workspaceId: string; query: string }): Promise<any[]> {
  const { data, error } = await supabase
    .from('reels')
    .select(`
      *,
      studies (id, title)
    `)
    .eq('workspace_id', args.workspaceId)
    .eq('enabled', true)
    .ilike('title', `%${args.query}%`)
    .limit(20);

  if (error) throw error;
  
  return (data || []).map((reel: any) => ({
    ...reel,
    _id: reel.id,
    _creationTime: new Date(reel.created_at).getTime(),
    studyId: reel.study_id,
    workspaceId: reel.workspace_id,
    findingIds: reel.finding_ids,
    sourceNames: reel.source_names,
    trackIndex: reel.track_index,
    studyTitle: reel.studies?.title,
  }));
}
