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
    .select('reel_id, reels!inner(*, studies!inner(title))')
    .eq('user_id', args.userId)
    .eq('reels.workspace_id', args.workspaceId)
    .order('created_at', { ascending: false });

  return (data || []).map((s) => s.reels);
}

export async function saveReel(args: { reelId: string; userId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== args.userId) throw new Error('Not authorized');

  const { error } = await supabase
    .from('saved_reels')
    .upsert({
      user_id: args.userId,
      reel_id: args.reelId,
    }, { onConflict: 'user_id,reel_id' });

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
    .select('*, users!inner(name, email, avatar)')
    .eq('reel_id', args.reelId)
    .order('created_at', { ascending: true });

  return (data || []).map((c: any) => ({
    ...c,
    author: {
      name: c.users.name,
      email: c.users.email,
      avatar: c.users.avatar,
    },
  }));
}

export async function addComment(args: {
  reelId: string;
  kind: 'note' | 'question' | 'action' | 'pushback' | 'reply';
  body: string;
  parentId?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id')
    .eq('id', args.reelId)
    .single();

  if (!reel) throw new Error('Reel not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      reel_id: args.reelId,
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
