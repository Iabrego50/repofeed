// Complete Supabase API - replaces Convex
import * as studiesModule from './studies-complete';
import * as workspacesModule from './workspaces-complete';
import * as feedModule from './feed-complete';
import * as generationModule from './generation-jobs';
import { mapReel } from './mappers';
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
    listSources: studiesModule.listSources,
    reviewReels: studiesModule.getReviewReels,
    setReelEnabled: studiesModule.setReelEnabled,
    publish: studiesModule.publishStudy,
    archive: studiesModule.archiveStudy,
    destroy: studiesModule.deleteStudy,
    getShareLink: studiesModule.getShareLink,
    setShareEnabled: studiesModule.setShareEnabled,
    regenerateShareLink: studiesModule.regenerateShareLink,
    updateReelScenes: studiesModule.updateReelScenes,
  },
  workspaces: {
    list: workspacesModule.listWorkspaces,
    mine: workspacesModule.listWorkspaces,
    create: workspacesModule.createWorkspace,
    rename: workspacesModule.renameWorkspace,
    members: workspacesModule.getMembers,
    listMembers: workspacesModule.listWorkspaceMembers,
    removeMember: workspacesModule.removeMember,
    listInvites: workspacesModule.listInvites,
    peekInvite: workspacesModule.peekInvite,
    revokeInvite: workspacesModule.revokeInvite,
  },
  feed: {
    list: feedModule.listReels,
    saved: async (args: { workspaceId: string; userId: string }) => {
      return feedModule.listSavedReels(args);
    },
    save: async (args: { reelId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Get workspace_id and study_id from the reel
      const { data: reel } = await supabase
        .from('reels')
        .select('workspace_id, study_id')
        .eq('id', args.reelId)
        .single();

      if (!reel) throw new Error('Reel not found');

      return feedModule.saveReel({ ...args, userId: user.id });
    },
    unsave: async (args: { reelId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      return feedModule.unsaveReel({ ...args, userId: user.id });
    },
    search: feedModule.searchReels,
    getComments: feedModule.getComments,
    addComment: feedModule.addComment,
    deleteComment: feedModule.deleteComment,
    react: feedModule.react,
    getEvidence: feedModule.getEvidence,
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

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ...data,
        _id: data.id,
        _creationTime: new Date(data.created_at).getTime(),
      };
    },
  },
  share: {
    publicTokenForReel: async (args: { reelId: string }): Promise<string | null> => {
      // Get the reel
      const { data: reel } = await supabase
        .from('reels')
        .select('study_id, enabled')
        .eq('id', args.reelId)
        .maybeSingle();

      if (!reel || !reel.enabled) return null;

      // Check if study is published
      const { data: study } = await supabase
        .from('studies')
        .select('id, status')
        .eq('id', reel.study_id)
        .single();

      if (!study || study.status !== 'published') return null;

      // Get or create the share link for this study
      const { data: shareLink } = await supabase
        .from('share_links')
        .select('token')
        .eq('study_id', study.id)
        .eq('revoked', false)
        .maybeSingle();

      if (shareLink) return shareLink.token;

      // No share link exists, return null (study owner needs to enable sharing first)
      return null;
    },
    feed: async (args: { token: string; secret?: string }) => {
      const { data, error } = await supabase
        .from('share_links')
        .select('*')
        .eq('token', args.token)
        .eq('revoked', false)
        .maybeSingle();

      if (error || !data) return null;

      // Get study info
      const { data: study } = await supabase
        .from('studies')
        .select('id, title')
        .eq('id', data.study_id)
        .single();

      // Get reels for this study
      const { data: reels } = await supabase
        .from('reels')
        .select('*, studies!inner(title)')
        .eq('study_id', data.study_id)
        .eq('enabled', true);

      // Get guest info if secret provided
      let guest = null;
      if (args.secret) {
        const { data: guestData } = await supabase
          .from('guests')
          .select('*')
          .eq('link_id', data.id)
          .eq('secret', args.secret)
          .maybeSingle();
        guest = guestData;
      }

      return {
        studyTitle: study?.title || 'Untitled Study',
        reels: (reels || []).map(mapReel),
        guest,
      };
    },
    join: async (args: { token: string; name: string }) => {
      const { data: link, error: linkError } = await supabase
        .from('share_links')
        .select('id, study_id')
        .eq('token', args.token)
        .eq('revoked', false)
        .maybeSingle();

      if (linkError || !link) throw new Error('Invalid share link');

      const secret = Math.random().toString(36).substring(2, 15);
      const { data: guest, error } = await supabase
        .from('guests')
        .insert({
          study_id: link.study_id,
          link_id: link.id,
          name: args.name,
          secret,
        })
        .select()
        .single();

      if (error) throw error;

      return { secret };
    },
  },
  art: {
    paintReel: async (args: { reelId: string }) => {
      // Stub: Art painting will be implemented
      console.log('Art painting not yet implemented for reel:', args.reelId);
      return { status: 'pending' };
    },
    paintStudy: async (args: { studyId: string }) => {
      // Stub: Art painting will be implemented
      console.log('Art painting not yet implemented for study:', args.studyId);
      return { status: 'pending' };
    },
  },
  footage: {
    listClips: async (args: { reelId: string }) => {
      // Stub: Footage management will be implemented
      return [];
    },
    selectClip: async (args: { reelId: string; clipId: string }) => {
      // Stub: Footage selection will be implemented
      return { success: true };
    },
  },
};

// Export types
export type API = typeof api;
