import { supabase } from '../supabase';

export async function loadProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, avatar')
    .eq('id', userId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    email: data.email || '',
    name: data.name || undefined,
    avatar: data.avatar || undefined,
  };
}
