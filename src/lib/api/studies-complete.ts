import { supabase } from '../supabase';
import { track } from '../analytics';
import { assertStudySlot } from '../billing/limits';
import { canSeeStudy, effectiveRole } from './access';
import { verifyScenes, buildSourceIndex } from '../reel/verify';
import { isFirstPublish } from './email-notify';
import { mapReel, type DbReel } from './mappers';
import { cleanTopics } from '../research-search';
import type { Plan, Role, StudyStatus } from '@/schema';
import type { Scene } from '@/schema/validators';

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
    .single();

  if (!membership) throw new Error('Not a workspace member');

  // Editors see all, members only see published
  const query = supabase
    .from('studies')
    .select('id, title, audience, status, tracks, published_at, is_demo, created_at')
    .eq('workspace_id', args.workspaceId)
    .eq('deleting', false)
    .order('created_at', { ascending: false })
    .limit(100);

  const role = effectiveRole(membership.role as Role, null);
  if (!canSeeStudy('draft', role)) {
    query.eq('status', 'published');
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((s) => ({
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
    .single();

  if (studyError || !study) throw new Error('Study not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor to create studies');
  }

  // Check study limit for free plan
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('paid_plan')
    .eq('id', args.workspaceId)
    .single();

  const plan = (workspace?.paid_plan as Plan | undefined) ?? 'free';
  await assertStudySlot(args.workspaceId, plan);

  const title = args.title.trim() || UNTITLED_STUDY;

  const { data, error } = await supabase
    .from('studies')
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
    .single();

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
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const updates: {
    updated_at: string;
    title?: string;
    audience?: string;
    goal?: string | null;
  } = { updated_at: new Date().toISOString() };
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
    .single();

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
    .single();

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

  const { count: priorSources } = await supabase
    .from('sources')
    .select('id', { count: 'exact', head: true });

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
    .single();

  if (error) throw error;
  if ((priorSources ?? 0) === 0) {
    track('first_upload', {
      workspaceId: study.workspace_id,
      studyId: args.studyId,
      kind: args.kind,
    });
  }
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
    .single();

  if (!source) throw new Error('Source not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', source.workspace_id)
    .eq('user_id', user.id)
    .single();

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
    .single();

  if (!study) throw new Error('Study not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('study_id', args.studyId)
    .order('position');

  if (error) throw error;
  // The review list reads camelCase fields (_id, trackIndex, sourceNames). Returning raw rows
  // left those undefined, and `sourceNames.join` threw as soon as a study had scenes.
  return (data || []).map((row) => ({ ...mapReel(row as DbReel), art: (row as { art?: unknown }).art ?? null }));
}

// Set reel enabled
export async function setReelEnabled(args: { reelId: string; enabled: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id')
    .eq('id', args.reelId)
    .single();

  if (!reel) throw new Error('Reel not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .single();

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
    .select('workspace_id, status, published_at, title, created_by')
    .eq('id', args.studyId)
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const firstPublish = isFirstPublish(study.published_at);

  const { error } = await supabase
    .from('studies')
    .update({
      status: 'published' as StudyStatus,
      published_at: study.published_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;
  return { firstPublish, workspaceId: study.workspace_id, title: study.title, createdBy: study.created_by };
}

// Archive study
export async function archiveStudy(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { data: sources } = await supabase
    .from('sources')
    .select('storage_id')
    .eq('study_id', args.studyId)
    .not('storage_id', 'is', null);

  const { error } = await supabase
    .from('studies')
    .update({ deleting: true, updated_at: new Date().toISOString() })
    .eq('id', args.studyId);

  if (error) throw error;

  const storageIds = (sources || [])
    .map((s) => s.storage_id)
    .filter((id): id is string => Boolean(id));
  if (storageIds.length > 0) {
    const { error: storageError } = await supabase.storage.from('uploads').remove(storageIds);
    if (storageError) {
      console.error('Failed to clean up storage objects:', storageError);
    }
  }
}

// List sources for a study
export async function listSources(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single();

  if (!study) throw new Error('Study not found');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not authorized');

  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('study_id', args.studyId)
    .order('created_at');

  if (error) throw error;
  
  return (data || []).map((s) => ({
    _id: s.id,
    _creationTime: new Date(s.created_at).getTime(),
    name: s.name,
    kind: s.kind,
    storageId: s.storage_id,
    chars: s.chars,
    size: s.chars,
    uploadedAt: new Date(s.created_at).getTime(),
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
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
export async function updateReelScenes(args: { reelId: string; title?: string; scenes: Scene[]; topics?: string[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: reel } = await supabase
    .from('reels')
    .select('workspace_id, study_id, title')
    .eq('id', args.reelId)
    .single();

  if (!reel) throw new Error('Reel not found');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', reel.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const { data: sources } = await supabase
    .from('sources')
    .select('text')
    .eq('study_id', reel.study_id);

  const sourceIndex = buildSourceIndex((sources || []).map((s) => s.text).join('\n'));
  const warning = verifyScenes(args.scenes, sourceIndex);
  const updates: {
    scenes: ReturnType<typeof JSON.parse>;
    updated_at: string;
    title?: string;
    topics?: string[];
    warning: string | null;
    enabled?: boolean;
  } = {
    scenes: JSON.parse(JSON.stringify(args.scenes)),
    updated_at: new Date().toISOString(),
    warning,
  };
  if (args.title !== undefined) updates.title = args.title;
  if (args.topics !== undefined) updates.topics = cleanTopics(args.topics);
  if (warning) updates.enabled = false;

  const { error } = await supabase
    .from('reels')
    .update(updates)
    .eq('id', args.reelId);

  if (error) throw error;
  return { warning };
}
