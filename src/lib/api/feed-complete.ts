import { supabase } from '../supabase';
import { mapReel, mapComment, mapFinding, type FeedReel, type Comment, type Finding } from './mappers';
import type { CommentKind } from '@/schema/validators';

export async function listReels(args: { workspaceId: string; studyId?: string }): Promise<FeedReel[]> {
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

  return (data || []).map(mapReel);
}

export async function listSavedReels(args: { workspaceId: string; userId: string }): Promise<FeedReel[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== args.userId) throw new Error('Not authorized');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) throw new Error('Not authorized');

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
    .in('id', reelIds)
    .eq('enabled', true);

  return (reels || []).map((row) => ({ ...mapReel(row), saved: true }));
}

export async function toggleSave(args: { reelId: string }): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id, study_id, enabled')
    .eq('id', args.reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found');
  if (!reel.enabled) throw new Error('Scene not found');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) throw new Error('Not authorized');

  const { data: existing } = await supabase
    .from('saved_reels')
    .select('id')
    .eq('user_id', user.id)
    .eq('reel_id', args.reelId)
    .maybeSingle();

  if (existing) {
    await unsaveReel({ reelId: args.reelId, userId: user.id });
    return false;
  }
  await saveReel({ reelId: args.reelId, userId: user.id });
  return true;
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

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) throw new Error('Not authorized');

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

export async function searchReels(args: { workspaceId: string; query: string }): Promise<FeedReel[]> {
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
  return (data || []).map(mapReel);
}

export async function getComments(args: { reelId: string }): Promise<Comment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data } = await supabase
    .from('comments')
    .select('*, users(name, email, avatar)')
    .eq('reel_id', args.reelId)
    .order('created_at', { ascending: true});

  return (data || []).map(mapComment);
}

export async function addComment(args: {
  reelId: string;
  kind: CommentKind;
  body: string;
  parentId?: string;
}): Promise<string> {
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
      resolved: false,
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

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id')
    .eq('id', comment.reel_id)
    .maybeSingle();
  const { data: membership } = reel
    ? await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', reel.workspace_id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const isOwn = comment.user_id === user.id;
  const isEditor = membership?.role === 'owner' || membership?.role === 'editor';
  if (!isOwn && !isEditor) throw new Error('Not authorized');

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', args.commentId);

  if (error) throw error;
}

export async function react(args: { reelId: string; kind: 'true' | 'surprised' | 'pushback' }): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel, error: reelError } = await supabase
    .from('reels')
    .select('study_id, workspace_id')
    .eq('id', args.reelId)
    .single();

  if (reelError || !reel) throw new Error('Reel not found');

  const { data: enabledReel } = await supabase
    .from('reels')
    .select('enabled')
    .eq('id', args.reelId)
    .maybeSingle();
  if (enabledReel && enabledReel.enabled === false) throw new Error('Scene not found');

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

export async function getEvidence(args: { reelId: string }): Promise<Finding[]> {
  const { data: reel, error } = await supabase
    .from('reels')
    .select('finding_ids, enabled, workspace_id')
    .eq('id', args.reelId)
    .single();

  if (error || !reel) throw new Error('Scene not found');
  if (!reel.enabled) throw new Error('Scene not found');
  if (!reel.finding_ids) return [];

  const findingIds = (Array.isArray(reel.finding_ids) 
    ? reel.finding_ids 
    : JSON.parse(reel.finding_ids as string)) as string[];
  
  if (findingIds.length === 0) return [];

  const { data: findings } = await supabase
    .from('findings')
    .select('id, study_id, type, text, speaker, number, label, created_at')
    .in('id', findingIds);

  return (findings || []).map(mapFinding);
}

export async function recordView(args: {
  reelId: string;
  completed: boolean;
  sessionId?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('record_reel_view', {
    p_reel_id: args.reelId,
    p_completed: args.completed,
    p_session_id: args.sessionId ?? null,
  });
  if (error) throw error;
}

export async function guestReact(args: { reelId: string; kind: 'true' | 'surprised' | 'pushback'; token: string; secret: string }) {
  const { data: links } = await supabase
    .from('share_links')
    .select('id, study_id')
    .eq('token', args.token)
    .single();
  
  if (!links) throw new Error('Share link not found');
  
  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('link_id', links.id)
    .eq('secret', args.secret)
    .single();
  
  if (!guest) throw new Error('Guest not found');
  
  await supabase
    .from('guest_reactions')
    .upsert({
      reel_id: args.reelId,
      study_id: links.study_id,
      guest_id: guest.id,
      kind: args.kind,
    });
}

export async function guestRecordView(args: {
  reelId: string;
  completed: boolean;
  token: string;
  secret: string;
  sessionId?: string;
}) {
  const { error } = await supabase.rpc('record_guest_reel_view', {
    p_reel_id: args.reelId,
    p_completed: args.completed,
    p_token: args.token,
    p_secret: args.secret,
    p_session_id: args.sessionId ?? null,
  });
  if (error) throw error;
}

export async function guestAddComment(args: { reelId: string; kind: 'note' | 'question' | 'action'; body: string; parentId?: string; token: string; secret: string }) {
  const { data: links } = await supabase
    .from('share_links')
    .select('id, study_id')
    .eq('token', args.token)
    .single();
  
  if (!links) throw new Error('Share link not found');
  
  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('link_id', links.id)
    .eq('secret', args.secret)
    .single();
  
  if (!guest) throw new Error('Guest not found');
  
  const { data: reel } = await supabase
    .from('reels')
    .select('study_id')
    .eq('id', args.reelId)
    .single();
  
  if (!reel) throw new Error('Reel not found');
  
  await supabase
    .from('comments')
    .insert({
      reel_id: args.reelId,
      study_id: reel.study_id,
      guest_id: guest.id,
      kind: args.kind,
      body: args.body,
      parent_id: args.parentId || null,
      resolved: false,
    });
}
