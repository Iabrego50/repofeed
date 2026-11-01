import { supabase } from '../supabase';
import { sendWorkspaceInvite } from '../emails';

export async function listWorkspaces() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces!inner(name, created_at)')
    .eq('user_id', user.id);

  return (data || []).map((m) => ({
    _id: m.workspace_id,
    name: m.workspaces.name,
    role: m.role,
    _creationTime: new Date(m.workspaces.created_at).getTime(),
  }));
}

export async function createWorkspace(args: { name: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: args.name.trim().slice(0, 60),
      created_by: user.id,
    })
    .select()
    .single();

  if (wsError) throw wsError;

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    });

  if (memberError) throw memberError;
  return workspace.id;
}

export async function renameWorkspace(args: { workspaceId: string; name: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check owner permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Must be workspace owner');
  }

  const { error } = await supabase
    .from('workspaces')
    .update({ name: args.name.trim().slice(0, 60), updated_at: new Date().toISOString() })
    .eq('id', args.workspaceId);

  if (error) throw error;
}

export async function getMembers(args: { workspaceId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) throw new Error('Not authorized');

  const { data } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, created_at, users!inner(name, email, avatar)')
    .eq('workspace_id', args.workspaceId);

  return (data || []).map((m: any) => ({
    _id: m.id,
    userId: m.user_id,
    role: m.role,
    name: m.users.name,
    email: m.users.email,
    avatar: m.users.avatar,
    _creationTime: new Date(m.created_at).getTime(),
  }));
}

export async function removeMember(args: { workspaceId: string; userId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check owner permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Must be workspace owner');
  }

  // Can't remove self if owner
  if (args.userId === user.id) {
    throw new Error('Owner cannot remove themselves');
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId);

  if (error) throw error;

  // Record removal to prevent re-joining via invite
  await supabase
    .from('workspace_removals')
    .insert({
      workspace_id: args.workspaceId,
      user_id: args.userId,
    });
}

export async function createInvite(args: {
  workspaceId: string;
  role: 'editor' | 'member';
  maxUses?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check owner/editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be owner or editor');
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: args.workspaceId,
      token,
      role: args.role,
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
      max_uses: args.maxUses || null,
    })
    .select()
    .single();

  if (error) throw error;
  return { token, url: `${process.env.VITE_SITE_URL}/invite/${token}` };
}

export async function listInvites(args: { workspaceId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not authorized');

  const { data } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString());

  return data || [];
}

export async function revokeInvite(args: { inviteId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: invite } = await supabase
    .from('workspace_invites')
    .select('workspace_id')
    .eq('id', args.inviteId)
    .single();

  if (!invite) throw new Error('Invite not found');

  // Check owner/editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be owner or editor');
  }

  const { error } = await supabase
    .from('workspace_invites')
    .update({ revoked: true })
    .eq('id', args.inviteId);

  if (error) throw error;
}

export async function peekInvite(args: { token: string }) {
  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select('workspace_id, role, expires_at, revoked, max_uses, uses, workspaces!inner(name)')
    .eq('token', args.token)
    .maybeSingle();

  if (error || !invite) return null;
  
  if (invite.revoked) return null;
  if (new Date(invite.expires_at) < new Date()) return null;
  if (invite.max_uses && invite.uses >= invite.max_uses) return null;

  return {
    workspaceName: invite.workspaces.name,
    role: invite.role,
  };
}

export async function acceptInvite(args: { token: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('token', args.token)
    .single();

  if (inviteError || !invite) throw new Error('Invite not found');
  
  if (invite.revoked) throw new Error('Invite has been revoked');
  if (new Date(invite.expires_at) < new Date()) throw new Error('Invite has expired');
  if (invite.max_uses && invite.uses >= invite.max_uses) throw new Error('Invite has been fully used');

  // Check if already a member
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return invite.workspace_id; // Already a member
  }

  // Check if previously removed
  const { data: removed } = await supabase
    .from('workspace_removals')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (removed) {
    throw new Error('You were removed from this workspace and cannot rejoin');
  }

  const { error: insertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
    });

  if (insertError) throw insertError;

  // Increment uses
  await supabase
    .from('workspace_invites')
    .update({ uses: invite.uses + 1 })
    .eq('id', invite.id);

  return invite.workspace_id;
}

// Alias for listMembers
export const listWorkspaceMembers = getMembers;
