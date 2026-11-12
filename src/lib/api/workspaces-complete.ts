import { supabase } from '../supabase';
import {
  assertEditorInviteAllowed,
  assertWorkspaceCreateAllowed,
  canCreateEditorInvite,
  canRemoveMember,
  canSetMemberRole,
  effectiveRole,
  inviteIsUsable,
  redactMemberEmail,
} from './access';
import { assertEditorSeat } from '../billing/limits';
import type { Plan, Role } from '@/schema';

export async function getWorkspace(args: { workspaceId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) throw new Error('Not authorized');

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, seat_overage, paid_plan')
    .eq('id', args.workspaceId)
    .maybeSingle();
  if (!workspace) throw new Error('Workspace not found');

  return {
    _id: workspace.id,
    name: workspace.name,
    role: effectiveRole(membership.role as Role, workspace.seat_overage),
    plan: workspace.paid_plan ?? 'free',
  };
}

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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('workspaces')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .gt('created_at', since);
  assertWorkspaceCreateAllowed(count || 0);

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

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('seat_overage')
    .eq('id', args.workspaceId)
    .maybeSingle();

  const viewerRole = effectiveRole(membership.role as Role, workspace?.seat_overage);

  const { data } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, created_at, users!inner(name, email, avatar)')
    .eq('workspace_id', args.workspaceId);

  return (data || []).map((m) => {
    const users = m.users as { name?: string; email?: string; avatar?: string };
    return {
      _id: m.id,
      userId: m.user_id,
      role: effectiveRole(m.role as Role, workspace?.seat_overage),
      name: users.name,
      email: redactMemberEmail(users.email, viewerRole),
      avatar: users.avatar,
      isMe: m.user_id === user.id,
      _creationTime: new Date(m.created_at).getTime(),
    };
  });
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

  const { count: ownerCount } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .eq('role', 'owner');

  const { data: target } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId)
    .maybeSingle();

  canRemoveMember(
    (membership?.role ?? 'member') as Role,
    (target?.role ?? 'member') as Role,
    args.userId === user.id,
    ownerCount || 0,
  );

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId);

  if (error) throw error;

  await supabase
    .from('workspace_removals')
    .insert({
      workspace_id: args.workspaceId,
      user_id: args.userId,
    });

  await supabase
    .from('workspace_invites')
    .update({ revoked: true })
    .eq('workspace_id', args.workspaceId)
    .eq('created_by', args.userId)
    .eq('revoked', false);
}

export async function setMemberRole(args: {
  workspaceId: string;
  userId: string;
  role: Role;
  plan?: Plan;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: target } = await supabase
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId)
    .maybeSingle();

  if (!target) throw new Error('Member not found');

  const { count: ownerCount } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .eq('role', 'owner');

  canSetMemberRole(
    (membership?.role ?? 'member') as Role,
    target.role as Role,
    args.role,
    ownerCount || 0,
  );

  if (args.role === 'editor') {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('paid_plan')
      .eq('id', args.workspaceId)
      .maybeSingle();
    const plan = args.plan ?? (workspace?.paid_plan as Plan | undefined) ?? 'free';
    await assertEditorSeat(args.workspaceId, plan);
  }

  const { error } = await supabase
    .from('workspace_members')
    .update({ role: args.role })
    .eq('id', target.id);
  if (error) throw error;
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
  if (args.role === 'editor' && !canCreateEditorInvite(membership.role as Role)) {
    throw new Error('Only owners can create editor invites');
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('paid_plan')
    .eq('id', args.workspaceId)
    .maybeSingle();
  const plan = (workspace?.paid_plan as Plan | undefined) ?? 'free';
  assertEditorInviteAllowed(plan, args.role);
  if (args.role === 'editor') {
    await assertEditorSeat(args.workspaceId, plan);
  }

  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

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
  // `process` does not exist in the browser, so build the link without it.
  const origin = typeof window !== 'undefined' ? window.location.origin : (typeof process !== 'undefined' ? process.env.VITE_SITE_URL ?? '' : '');
  return { token, url: `${origin}/invite/${token}` };
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

export async function peekInvite(args: { token: string }): Promise<
  | { status: "ok"; workspaceName: string; role: string }
  | { status: "invalid" | "expired" | "used up" }
> {
  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select('workspace_id, role, expires_at, revoked, max_uses, uses, workspaces!inner(name)')
    .eq('token', args.token)
    .maybeSingle();

  if (error || !invite) return { status: 'invalid' };

  const status = inviteIsUsable(invite);
  if (status !== 'ok') return { status };

  return {
    status: 'ok',
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
  
  const usable = inviteIsUsable(invite);
  if (usable === 'invalid') throw new Error('Invite has been revoked');
  if (usable === 'expired') throw new Error('Invite has expired');
  if (usable === 'used up') throw new Error('Invite has been used up');

  if (invite.role === 'editor') {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('paid_plan')
      .eq('id', invite.workspace_id)
      .maybeSingle();
    await assertEditorSeat(invite.workspace_id, (workspace?.paid_plan as Plan | undefined) ?? 'free');
  }

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
