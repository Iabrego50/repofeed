import { supabase } from '../supabase';
import { FREE_STUDY_LIMIT } from '../billing/limits';
import type { StudyStatus } from '@/schema/validators';

const UNTITLED_STUDY = 'Untitled Study';
const MAX_SOURCE_CHARS = 1_000_000;

// List studies for a workspace
export async function listStudies(args: { workspaceId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership) throw new Error('Not a workspace member');

  const isEditor = membership.role === 'owner' || membership.role === 'editor';

  // Editors see all, members only see published
  const query = supabase
    .from('studies')
    .select('id, title, audience, status, tracks, published_at, is_demo, created_at')
    .eq('workspace_id', args.workspaceId)
    .eq('deleting', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!isEditor) {
    query.eq('status', 'published');
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((s: any) => ({
    _id: s.id,
    _creationTime: new Date(s.created_at).getTime(),
    title: s.title,
    audience: s.audience,
    status: s.status,
    tracks: s.tracks || [],
    publishedAt: s.published_at,
    isDemo: s.is_demo || false,
  }));
}

// Get single study
export async function getStudy(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('*')
    .eq('id', args.studyId)
    .single() as any;

  if (studyError || !study) throw new Error('Study not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership) throw new Error('Not authorized');

  return {
    ...study,
    _id: study.id,
    _creationTime: new Date(study.created_at).getTime(),
    role: membership.role,
  };
}

// Create study
export async function createStudy(args: {
  workspaceId: string;
  title: string;
  audience: string;
  goal?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership - must be editor
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor to create studies');
  }

  // Check study limit for free plan
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('paid_plan')
    .eq('id', args.workspaceId)
    .single() as any;

  if (!workspace?.paid_plan) {
    const { count } = await supabase
      .from('studies')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', args.workspaceId)
      .in('status', ['draft', 'generating', 'review', 'published']);

    if ((count || 0) >= FREE_STUDY_LIMIT) {
      throw new Error(
        `Free workspaces can have ${FREE_STUDY_LIMIT} studies. Upgrade to Pro for unlimited studies.`
      );
    }
  }

  const title = args.title.trim() || UNTITLED_STUDY;

  const { data, error } = await supabase
    .from('studies')
    // @ts-expect-error - Supabase typing
    .insert({
      workspace_id: args.workspaceId,
      title: title.slice(0, 120),
      audience: args.audience.trim().slice(0, 200),
      goal: args.goal?.trim().slice(0, 300) || null,
      status: 'draft',
      tracks: [],
      created_by: user.id,
    })
    .select()
    .single() as any;

  if (error) throw error;
  return data.id;
}

// Update study details
export async function updateStudy(args: {
  studyId: string;
  title?: string;
  audience?: string;
  goal?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const updates: any = { updated_at: new Date().toISOString() };
  if (args.title !== undefined) updates.title = args.title.trim().slice(0, 120);
  if (args.audience !== undefined) updates.audience = args.audience.trim().slice(0, 200);
  if (args.goal !== undefined) updates.goal = args.goal?.trim().slice(0, 300) || null;

  const { error } = await supabase
    .from('studies')
    .update(updates)
    .eq('id', args.studyId);

  if (error) throw error;
}

// Add source
export async function addSource(args: {
  studyId: string;
  name: string;
  kind: 'file' | 'paste';
  storageId?: string;
  text: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id, status')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');
  if (study.status !== 'draft') {
    throw new Error('Can only add sources to draft studies');
  }

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  // Check total size
  const { data: sources } = await supabase
    .from('sources')
    .select('chars')
    .eq('study_id', args.studyId);

  const totalChars = (sources || []).reduce((sum, s) => sum + (s.chars || 0), 0);
  if (totalChars + args.text.length > MAX_SOURCE_CHARS) {
    throw new Error('Study sources are too large (1 million characters max)');
  }

  const { data, error } = await supabase
    .from('sources')
    .insert({
      study_id: args.studyId,
      workspace_id: study.workspace_id,
      name: args.name.slice(0, 200),
      kind: args.kind,
      storage_id: args.storageId || null,
      text: args.text,
      chars: args.text.length,
    })
    .select()
    .single() as any;

  if (error) throw error;
  return data.id;
}

// Remove source
export async function removeSource(args: { sourceId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: source } = await supabase
    .from('sources')
    .select('study_id, workspace_id')
    .eq('id', args.sourceId)
    .single() as any;

  if (!source) throw new Error('Source not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', source.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', args.sourceId);

  if (error) throw error;
}

// Get review reels
export async function getReviewReels(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('study_id', args.studyId)
    .order('position');

  if (error) throw error;
  return data || [];
}

// Set reel enabled
export async function setReelEnabled(args: { reelId: string; enabled: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id')
    .eq('id', args.reelId)
    .single() as any;

  if (!reel) throw new Error('Reel not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { error } = await supabase
    .from('reels')
    .update({ enabled: args.enabled, updated_at: new Date().toISOString() })
    .eq('id', args.reelId);

  if (error) throw error;
}

// Publish study
export async function publishStudy(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id, status')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { error } = await supabase
    .from('studies')
    .update({
      status: 'published' as StudyStatus,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;
}

// Archive study
export async function archiveStudy(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { error } = await supabase
    .from('studies')
    .update({
      status: 'archived' as StudyStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;
}

// Delete study (mark for deletion)
export async function deleteStudy(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  // Soft delete
  const { error } = await supabase
    .from('studies')
    .update({ deleting: true, updated_at: new Date().toISOString() })
    .eq('id', args.studyId);

  if (error) throw error;

  // TODO: Schedule actual deletion cleanup
}

// List sources for a study
export async function listSources(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('study_id', args.studyId)
    .order('created_at');

  if (error) throw error;
  
  return (data || []).map((s: any) => ({
    _id: s.id,
    _creationTime: new Date(s.created_at).getTime(),
    name: s.name,
    kind: s.kind,
    storageId: s.storage_id,
    chars: s.chars,
  }));
}

// Get share link for a study
export async function getShareLink(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id, share_enabled, share_token')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  return {
    enabled: study.share_enabled || false,
    token: study.share_token || null,
  };
}

// Set share enabled for a study
export async function setShareEnabled(args: { studyId: string; enabled: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id, share_token')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  // Generate token if enabling and doesn't exist
  let token = study.share_token;
  if (args.enabled && !token) {
    token = crypto.randomUUID();
  }

  const { error } = await supabase
    .from('studies')
    .update({
      share_enabled: args.enabled,
      share_token: token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;

  return { token };
}

// Regenerate share link for a study
export async function regenerateShareLink(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single() as any;

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const newToken = crypto.randomUUID();

  const { error } = await supabase
    .from('studies')
    .update({
      share_token: newToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;

  return { token: newToken };
}

// Update reel scenes
export async function updateReelScenes(args: { reelId: string; scenes: any[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id')
    .eq('id', args.reelId)
    .single() as any;

  if (!reel) throw new Error('Reel not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .single() as any;

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { error } = await supabase
    .from('reels')
    .update({
      scenes: args.scenes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.reelId);

  if (error) throw error;
}
