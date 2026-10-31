import { supabase } from '../supabase';
import type { Study, StudyStatus } from '@/schema';

export async function listStudies(args: { workspaceId: string }) {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    _id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    status: row.status as StudyStatus,
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
    status: data.status as StudyStatus,
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
      description: args.description,
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
  status?: StudyStatus;
}) {
  const updates: any = {
    updated_at: new Date().toISOString(),
  };
  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status;

  const { error } = await supabase
    .from('studies')
    .update(updates)
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
