import { supabase } from '../supabase';

export async function listStudies(args: { workspaceId: string }) {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data as any[]) || []).map((row) => ({
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

  const row = data as any;
  return {
    ...row,
    _id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    status: row.status,
    isDemo: row.is_demo,
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
      description: args.description,
      status: 'draft',
      is_demo: false,
    } as any)
    .select()
    .single();

  if (error) throw error;

  const row = data as any;
  return {
    ...row,
    _id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
  };
}

export async function updateStudy(args: {
  studyId: string;
  title?: string;
  description?: string;
  status?: string;
}) {
  const updates: any = {
    updated_at: new Date().toISOString(),
  };
  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status;

  const { error } = await supabase
    .from('studies')
  // @ts-expect-error - Supabase insert type
    .update(updates as any)
    .eq('id', args.studyId);

  if (error) throw error;
}

export async function deleteStudy(args: { studyId: string }) {
  const { error } = await supabase
    .from('studies')
    .delete()
    .eq('id', args.studyId);

  if (error) throw error;
}

export async function publishStudy(args: { studyId: string }) {
  const { error } = await supabase
    .from('studies')
  // @ts-expect-error - Supabase update type
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', args.studyId);

  if (error) throw error;
}

export async function archiveStudy(args: { studyId: string }) {
  const { error } = await supabase
    .from('studies')
  // @ts-expect-error - Supabase update type
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', args.studyId);

  if (error) throw error;
}
