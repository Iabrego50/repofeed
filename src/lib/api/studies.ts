import { supabase } from '../supabase';

export async function listStudies(args: { workspaceId: string }) {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    _id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    status: row.status,
    isDemo: row.is_demo,
  }));
}

export async function getStudy(args: { studyId: string }) {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('id', args.studyId)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    _id: data.id,
    _creationTime: new Date(data.created_at).getTime(),
    workspaceId: data.workspace_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    status: data.status,
    isDemo: data.is_demo,
  };
}

export async function createStudy(args: {
  workspaceId: string;
  title: string;
  description?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('studies')
    .insert({
      workspace_id: args.workspaceId,
      created_by: user.id,
      title: args.title,
      audience: args.description || '',
      status: 'draft',
      is_demo: false,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    _id: data.id,
    _creationTime: new Date(data.created_at).getTime(),
    workspaceId: data.workspace_id,
    createdBy: data.created_by,
  };
}

export async function updateStudy(args: {
  studyId: string;
  title?: string;
  description?: string;
  status?: string;
}) {
  const updates: {
    updated_at: string;
    title?: string;
    audience?: string;
    status?: 'draft' | 'generating' | 'review' | 'published' | 'archived';
  } = {
    updated_at: new Date().toISOString(),
  };
  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.audience = args.description;
  if (args.status !== undefined) {
    updates.status = args.status as 'draft' | 'generating' | 'review' | 'published' | 'archived';
  }

  const { error } = await supabase
    .from('studies')
    .update(updates)
    .eq('id', args.studyId);

  if (error) throw error;
}

export async function deleteStudy(args: { studyId: string }) {
  // First, get all storage objects associated with this study's sources
  const { data: sources } = await supabase
    .from('sources')
    .select('storage_id')
    .eq('study_id', args.studyId)
    .not('storage_id', 'is', null);

  // Delete the study (cascades to sources, reels, etc.)
  const { error: deleteError } = await supabase
    .from('studies')
    .delete()
    .eq('id', args.studyId);

  if (deleteError) throw deleteError;

  // Clean up storage objects
  if (sources && sources.length > 0) {
    const storageIds = sources
      .map(s => s.storage_id)
      .filter((id): id is string => id !== null);

    if (storageIds.length > 0) {
      // Delete from storage bucket
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove(storageIds.map(id => id));

      // Log but don't throw - storage cleanup is best-effort
      if (storageError) {
        console.error('Failed to clean up storage objects:', storageError);
      }
    }
  }
}

export async function publishStudy(args: { studyId: string }) {
  const { error } = await supabase
    .from('studies')
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;
}

export async function archiveStudy(args: { studyId: string }) {
  const { error } = await supabase
    .from('studies')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.studyId);

  if (error) throw error;
}
