import { supabase } from '../supabase';

export interface EmailPrefs {
  email: string | null;
  newStudies: boolean;
  feedback: boolean;
}

export async function getEmailPrefs(workspaceId: string): Promise<EmailPrefs> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!member) throw new Error('Not authorized');

  // Get user email
  const { data: userData } = await supabase
    .from('users')
    .select('email')
    .eq('id', user.id)
    .single();

  // Get preferences (defaults to true if not set)
  const { data: prefs } = await supabase
    .from('email_prefs')
    .select('new_studies, feedback')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  return {
    email: userData?.email || null,
    newStudies: prefs?.new_studies ?? true,
    feedback: prefs?.feedback ?? true,
  };
}

export async function setEmailPrefs(args: {
  workspaceId: string;
  newStudies?: boolean;
  feedback?: boolean;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!member) throw new Error('Not authorized');

  // Get existing prefs
  const { data: existing } = await supabase
    .from('email_prefs')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  const updates = {
    new_studies: args.newStudies ?? existing?.new_studies ?? true,
    feedback: args.feedback ?? existing?.feedback ?? true,
  };

  if (existing) {
    await supabase
      .from('email_prefs')
      .update(updates)
      .eq('workspace_id', args.workspaceId)
      .eq('user_id', user.id);
  } else {
    await supabase
      .from('email_prefs')
      .insert({
        workspace_id: args.workspaceId,
        user_id: user.id,
        ...updates,
      });
  }
}
