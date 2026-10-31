import { supabase } from '../supabase';
import * as billing from '../billing/stripe';
import * as studies from './studies';
import * as feed from './feed';

// Billing API
export const billingApi = {
  getPlan: async (args: { workspaceId: string }) => {
    const { data } = await supabase
      .from('workspaces')
      .select('customer_id, paid_plan')
      .eq('id', args.workspaceId)
      .single();

    const workspace = data as any;
    if (!workspace) return { plan: 'free' };

    if (workspace.customer_id) {
      const plan = await billing.getPlanFromStripe(workspace.customer_id);
      return { plan };
    }

    return { plan: workspace.paid_plan || 'free' };
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

      const workspace = workspaceData as any;

      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = user ? await supabase
        .from('users')
        .select('trial_used_at')
        .eq('id', user.id)
        .single() : { data: null };

      const userInfo = userData as any;

      return {
        studies: studiesCount || 0,
        editors: editorsCount || 0,
        seats: workspace?.seats || null,
        interval: null, // TODO: Parse from seat_variant
        lapsedPlan: workspace?.lapsed_plan || null,
        seatOverage: workspace?.seat_overage || false,
        trialUsed: !!userInfo?.trial_used_at,
      };
    },

    plan: async (args: { workspaceId: string }) => {
      const { data } = await supabase
        .from('workspaces')
        .select('paid_plan, seat_variant, customer_id')
        .eq('id', args.workspaceId)
        .single();

      const workspace = data as any;
      let plan: any = 'free';
      if (workspace?.customer_id) {
        plan = await billing.getPlanFromStripe(workspace.customer_id);
      } else if (workspace?.paid_plan) {
        plan = workspace.paid_plan;
      }

      return {
        plan,
        variant: workspace?.seat_variant,
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

    const userInfo = data as any;
    if (!userInfo) return null;

    return {
      ...userInfo,
      _id: userInfo.id,
      _creationTime: new Date(userInfo.created_at).getTime(),
      tokenIdentifier: userInfo.token_identifier,
      onboardedAt: userInfo.onboarded_at,
      trialUsedAt: userInfo.trial_used_at,
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
    // @ts-expect-error - Supabase update type inference issue
      .update(updates)
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
