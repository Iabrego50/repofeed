import { supabase } from '../supabase';

export async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, avatar')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email || '',
    name: data.name || undefined,
    avatar: data.avatar || undefined,
  };
}
