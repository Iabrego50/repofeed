// Complete API module - all Convex functions reimplemented with Supabase
import { supabase } from '../supabase';
import * as studies from './studies';
import * as feed from './feed';

// Studies API
export const studiesApi = {
  list: studies.listStudies,
  get: studies.getStudy,
  create: studies.createStudy,
  update: studies.updateStudy,
  delete: studies.deleteStudy,
  publish: studies.publishStudy,
  archive: studies.archiveStudy,
};

// Feed API
export const feedApi = {
  list: feed.listReels,
  saved: async (args: { workspaceId: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return feed.listSavedReels({ ...args, userId: user.id });
  },
  search: feed.searchReels,
  save: async (args: { reelId: string; workspaceId: string; studyId: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return feed.saveReel({ ...args, userId: user.id });
  },
  unsave: async (args: { reelId: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return feed.unsaveReel({ ...args, userId: user.id });
  },
};

// Billing API stubs
export const billingApi = {
  data: {
    usage: async (args: { workspaceId: string }) => {
      const { count } = await supabase
        .from('studies')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', args.workspaceId)
        .neq('status', 'archived');
      
      return { studies: count || 0 };
    },
    plan: async (args: { workspaceId: string }) => {
      const { data } = await supabase
        .from('workspaces')
        .select('paid_plan, seat_variant')
        .eq('id', args.workspaceId)
        .single();
      
      return {
        plan: (data as any)?.paid_plan || 'free',
        variant: (data as any)?.seat_variant,
      };
    },
  },
  checkout: async (args: any) => {
    console.warn('Billing checkout not implemented yet');
    throw new Error('Billing system not configured');
  },
  portal: async (args: any) => {
    console.warn('Billing portal not implemented yet');
    throw new Error('Billing system not configured');
  },
};

// Users API
export const usersApi = {
  current: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (!data) return null;
    
    return {
      ...(data as any),
      _id: (data as any).id,
      _creationTime: new Date((data as any).created_at).getTime(),
      tokenIdentifier: (data as any).token_identifier,
      onboardedAt: (data as any).onboarded_at,
      trialUsedAt: (data as any).trial_used_at,
    };
  },
  update: async (args: { name?: string; email?: string; onboardedAt?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.onboardedAt !== undefined) updates.onboarded_at = args.onboardedAt;
    
    const { error } = await supabase
      .from('users')
      .update(updates as any)
      .eq('id', user.id);
    
    if (error) throw error;
  },
};

// Combined API object
export const api = {
  studies: studiesApi,
  feed: feedApi,
  billing: billingApi,
  users: usersApi,
};
