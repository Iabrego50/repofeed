import { supabase } from '../supabase';
import type { Plan } from '@/schema';

export const FREE_STUDY_LIMIT = 3;
export const TRIAL_DAYS = 14;
export const TEAM_MIN_SEATS = 2;
export const FEATURE_PRO = "Share links";
export const FEATURE_TEAM = "Adding more editors";

export const EDITOR_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: 1,
  team: Number.POSITIVE_INFINITY,
};

export function teamSeats(editors: number): number {
  return Math.max(TEAM_MIN_SEATS, editors);
}

export async function countActiveStudies(workspaceId: string, cap: number = 100): Promise<number> {
  const { count } = await supabase
    .from('studies')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived')
    .neq('is_demo', true)
    .limit(cap);
  
  return Math.min(count || 0, cap);
}

export async function countEditors(workspaceId: string, cap: number = 500): Promise<number> {
  const { count } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'editor'])
    .limit(cap);
  
  return count || 0;
}

export async function assertStudySlot(workspaceId: string, plan: Plan): Promise<void> {
  if (plan !== 'free') return;
  const count = await countActiveStudies(workspaceId, FREE_STUDY_LIMIT);
  if (count >= FREE_STUDY_LIMIT) {
    throw new Error(
      `The Free plan includes ${FREE_STUDY_LIMIT} active studies. Upgrade to Pro for unlimited studies, or archive one.`
    );
  }
}

export async function assertEditorSeat(workspaceId: string, plan: Plan): Promise<void> {
  const limit = EDITOR_LIMIT[plan];
  if (!Number.isFinite(limit)) return;
  const count = await countEditors(workspaceId, limit);
  if (count >= limit) {
    throw new Error(
      'Adding more editors needs the Team plan. Members who watch and discuss are always free.'
    );
  }
}

export function assertPaid(plan: Plan, feature: string): void {
  if (plan !== 'free') return;
  throw new Error(
    `${feature} are part of Pro. Upgrade in Plan and billing to use them.`
  );
}
