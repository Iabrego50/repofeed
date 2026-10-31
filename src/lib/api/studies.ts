import { supabase } from '../supabase';
import type { Database } from '../database.types';

type Study = Database['public']['Tables']['studies']['Row'];
type StudyInsert = Database['public']['Tables']['studies']['Insert'];

export async function listStudies(workspaceId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getStudy(id: string) {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createStudy(study: any) {
  const { data, error } = await supabase
    .from('studies')
    .insert(study as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStudy(id: string, updates: any) {
  const { data, error} = await supabase
    .from('studies')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStudy(id: string) {
  const { error } = await supabase
    .from('studies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function publishStudy(id: string) {
  return updateStudy(id, {
    status: 'published',
    published_at: new Date().toISOString(),
  });
}

export async function archiveStudy(id: string) {
  return updateStudy(id, { status: 'archived' as any });
}
