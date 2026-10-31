// Complete Supabase API - replaces Convex
import * as studiesModule from './studies-complete';
import * as workspacesModule from './workspaces-complete';
import * as feedModule from './feed-complete';
import * as generationModule from './generation-jobs';
import { supabase } from '../supabase';
import * as billing from '../billing/stripe';

// Export organized API object matching Convex structure
export const api = {
  studies: {
    list: studiesModule.listStudies,
    get: studiesModule.getStudy,
    create: studiesModule.createStudy,
    updateDetails: studiesModule.updateStudy,
    addSource: studiesModule.addSource,
    removeSource: studiesModule.removeSource,
    reviewReels: studiesModule.getReviewReels,
    setReelEnabled: studiesModule.setReelEnabled,
    publish: studiesModule.publishStudy,
    archive: studiesModule.archiveStudy,
    destroy: studiesModule.deleteStudy,
  },
  workspaces: {
    list: workspacesModule.listWorkspaces,
    create: workspacesModule.createWorkspace,
    rename: workspacesModule.renameWorkspace,
    members: workspacesModule.getMembers,
    removeMember: workspacesModule.removeMember,
    listInvites: workspacesModule.listInvites,
    peekInvite: workspacesModule.peekInvite,
    revokeInvite: workspacesModule.revokeInvite,
  },
  feed: {
    list: feedModule.listReels,
    saved: feedModule.listSavedReels,
    save: feedModule.saveReel,
    unsave: feedModule.unsaveReel,
    search: feedModule.searchReels,
    comments: feedModule.getComments,
    addComment: feedModule.addComment,
  },
  generation: {
    jobs: {
      latestForStudy: generationModule.getLatestJob,
      startGeneration: generationModule.startGeneration,
      resumeGeneration: generationModule.resumeGeneration,
      cancelGeneration: generationModule.cancelGeneration,
    },
  },
  billing: {
    actions: {
      createStudy: async (args: { workspaceId: string; title: string; audience: string; goal?: string }) => {
        return studiesModule.createStudy(args);
      },
      acceptInvite: workspacesModule.acceptInvite,
      createInvite: workspacesModule.createInvite,
      checkout: async (args: { workspaceId: string; plan: 'pro' | 'team'; interval: 'month' | 'year'; successUrl: string; cancelUrl: string }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        return billing.createCheckoutSession({ ...args, userId: user.id });
      },
      portal: async (args: { workspaceId: string; returnUrl: string }) => {
        return billing.createPortalSession(args);
      },
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

        return {
          studies: studiesCount || 0,
          editors: editorsCount || 0,
        };
      },
    },
  },
  users: {
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
      };
    },
  },
};

// Export types
export type API = typeof api;
