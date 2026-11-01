import { supabase } from '../supabase';
import * as billing from '../billing/stripe';
import * as studies from './studies';
import * as feed from './feed';
import * as insights from './insights';

// Billing API
export const billingApi = {
  getPlan: async (args: { workspaceId: string }) => {
    const { data } = await supabase
      .from('workspaces')
      .select('customer_id, paid_plan')
      .eq('id', args.workspaceId)
      .single();

    if (!data) return { plan: 'free' };

    if (data.customer_id) {
      const plan = await billing.getPlanFromStripe(data.customer_id);
      return { plan };
    }

    return { plan: data.paid_plan || 'free' };
  },

  checkout: async (args: {
    workspaceId: string;
    plan: 'pro' | 'team';
    interval: 'month' | 'year';
    successUrl: string;
    cancelUrl: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return billing.createCheckoutSession({
      ...args,
      userId: user.id,
    });
  },

  portal: async (args: { workspaceId: string; returnUrl: string }) => {
    return billing.createPortalSession(args);
  },

  data: {
    usage: async (args: { workspaceId: string }) => {
      const { count: studiesCount } = await supabase
        .from('studies')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', args.workspaceId)
        .neq('status', 'archived');

      const { count: editorsCount } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', args.workspaceId)
        .in('role', ['owner', 'editor']);

      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('seats, seat_variant, lapsed_plan, seat_overage')
        .eq('id', args.workspaceId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = user ? await supabase
        .from('users')
        .select('trial_used_at')
        .eq('id', user.id)
        .single() : { data: null };

      return {
        studies: studiesCount || 0,
        editors: editorsCount || 0,
        seats: workspaceData?.seats || null,
        interval: null, // TODO: Parse from seat_variant
        lapsedPlan: workspaceData?.lapsed_plan || null,
        seatOverage: workspaceData?.seat_overage || false,
        trialUsed: !!userData?.trial_used_at,
      };
    },

    plan: async (args: { workspaceId: string }) => {
      const { data } = await supabase
        .from('workspaces')
        .select('paid_plan, seat_variant, customer_id')
        .eq('id', args.workspaceId)
        .single();

      let plan: string = 'free';
      if (data?.customer_id) {
        plan = await billing.getPlanFromStripe(data.customer_id);
      } else if (data?.paid_plan) {
        plan = data.paid_plan;
      }

      return {
        plan,
        variant: data?.seat_variant,
      };
    },
  },
};

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
      ...data,
      _id: data.id,
      _creationTime: new Date(data.created_at).getTime(),
      tokenIdentifier: data.token_identifier,
      onboardedAt: data.onboarded_at,
      trialUsedAt: data.trial_used_at,
    };
  },
  update: async (args: { name?: string; email?: string; onboardedAt?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates: {
      name?: string;
      email?: string;
      onboarded_at?: string;
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.onboardedAt !== undefined) updates.onboarded_at = args.onboardedAt;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;
  },
};

// Insights API
export const insightsApi = {
  summary: insights.summary,
  watchers: insights.watchers,
  exportComments: insights.exportComments,
};

// Combined API object
export const api = {
  studies: studiesApi,
  feed: feedApi,
  billing: billingApi,
  users: usersApi,
  insights: insightsApi,
};
