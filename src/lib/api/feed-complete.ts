import { supabase } from '../supabase';

export async function listReels(args: { workspaceId: string; studyId?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not authorized');

  let query = supabase
    .from('reels')
    .select('*, studies!inner(title, status)')
    .eq('workspace_id', args.workspaceId)
    .eq('enabled', true)
    .order('created_at', { ascending: false })
    .limit(100);

  if (args.studyId) {
    query = query.eq('study_id', args.studyId);
  }

  // Only show reels from published studies for non-editors
  if (membership.role === 'member') {
    query = query.eq('studies.status', 'published');
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function listSavedReels(args: { workspaceId: string; userId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== args.userId) throw new Error('Not authorized');

  const { data } = await supabase
    .from('saved_reels')
    .select('reel_id')
    .eq('user_id', args.userId)
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false });

  if (!data) return [];

  const reelIds = data.map((s) => s.reel_id);
  if (reelIds.length === 0) return [];

  const { data: reels } = await supabase
    .from('reels')
    .select('*, studies!inner(title)')
    .in('id', reelIds);

  return reels || [];
}

export async function saveReel(args: { reelId: string; userId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== args.userId) throw new Error('Not authorized');

  // Get workspace_id and study_id from the reel
  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id, study_id')
    .eq('id', args.reelId)
    .single();

  if (!reel) throw new Error('Reel not found');

  const { error } = await supabase
    .from('saved_reels')
    .upsert({
      user_id: args.userId,
      reel_id: args.reelId,
      workspace_id: reel.workspace_id,
      study_id: reel.study_id,
    }, { onConflict: 'reel_id,user_id' });

  if (error) throw error;
}

export async function unsaveReel(args: { reelId: string; userId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== args.userId) throw new Error('Not authorized');

  const { error } = await supabase
    .from('saved_reels')
    .delete()
    .eq('user_id', args.userId)
    .eq('reel_id', args.reelId);

  if (error) throw error;
}

export async function searchReels(args: { workspaceId: string; query: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not authorized');

  // Simple text search - can be improved with full-text search
  const searchTerm = `%${args.query.toLowerCase()}%`;
  
  const { data, error } = await supabase
    .from('reels')
    .select('*, studies!inner(title, status)')
    .eq('workspace_id', args.workspaceId)
    .eq('enabled', true)
    .or(`title.ilike.${searchTerm},track.ilike.${searchTerm}`)
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function getComments(args: { reelId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('reel_id', args.reelId)
    .order('created_at', { ascending: true});

  return data || [];
}

export async function addComment(args: {
  reelId: string;
  kind: 'comment' | 'reply';
  body: string;
  parentId?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel, error: reelError } = await supabase
    .from('reels')
    .select('workspace_id, study_id')
    .eq('id', args.reelId)
    .single();

  if (reelError || !reel) throw new Error('Reel not found');

  // Check membership
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      reel_id: args.reelId,
      study_id: reel.study_id,
      kind: args.kind,
      body: args.body.trim(),
      parent_id: args.parentId || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function deleteComment(args: { commentId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select('reel_id, user_id')
    .eq('id', args.commentId)
    .single();

  if (commentError || !comment) throw new Error('Comment not found');
  if (comment.user_id !== user.id) throw new Error('Not authorized');

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', args.commentId);

  if (error) throw error;
}

export async function react(args: { reelId: string; kind: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel, error: reelError } = await supabase
    .from('reels')
    .select('study_id, workspace_id')
    .eq('id', args.reelId)
    .single();

  if (reelError || !reel) throw new Error('Reel not found');

  const { data: existing } = await supabase
    .from('reactions')
    .select('id, kind')
    .eq('reel_id', args.reelId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.kind === args.kind) {
    await supabase.from('reactions').delete().eq('id', existing.id);
    return null;
  }

  if (existing) {
    await supabase.from('reactions').update({ kind: args.kind }).eq('id', existing.id);
  } else {
    await supabase.from('reactions').insert({
      reel_id: args.reelId,
      study_id: reel.study_id,
      user_id: user.id,
      kind: args.kind,
    });
  }

  return args.kind;
}

export async function getEvidence(args: { reelId: string }) {
  const { data: reel, error } = await supabase
    .from('reels')
    .select('finding_ids')
    .eq('id', args.reelId)
    .single();

  if (error || !reel || !reel.finding_ids) return [];

  const findingIds = (Array.isArray(reel.finding_ids) 
    ? reel.finding_ids 
    : JSON.parse(reel.finding_ids as string)) as string[];
  
  if (findingIds.length === 0) return [];

  const { data: findings } = await supabase
    .from('findings')
    .select('id, type, text, speaker, number, label')
    .in('id', findingIds);

  return findings || [];
}
