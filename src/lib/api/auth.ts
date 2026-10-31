import { supabase } from '../supabase';

export async function loadProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, avatar')
    .eq('id', userId)
    .single();

  const user = data as any;
  if (!user) return null;

  return {
    id: user.id,
    email: user.email || '',
    name: user.name || undefined,
    avatar: user.avatar || undefined,
  };
}
