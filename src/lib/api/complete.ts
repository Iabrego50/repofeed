// Complete Supabase API - replaces Convex
import * as studiesModule from './studies-complete';
import * as workspacesModule from './workspaces-complete';
import * as feedModule from './feed-complete';
import * as generationModule from './generation-jobs';
import * as shareModule from './share';
import * as footageModule from './footage';
import { supabase } from '../supabase';
import * as billing from '../billing/stripe';
import { jsonAuthHeaders } from './bearer';

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
    get: workspacesModule.getWorkspace,
    list: workspacesModule.listWorkspaces,
    mine: workspacesModule.listWorkspaces,
    create: workspacesModule.createWorkspace,
    rename: workspacesModule.renameWorkspace,
    members: workspacesModule.getMembers,
    listMembers: workspacesModule.listWorkspaceMembers,
    removeMember: workspacesModule.removeMember,
    setMemberRole: workspacesModule.setMemberRole,
    createInvite: workspacesModule.createInvite,
    acceptInvite: workspacesModule.acceptInvite,
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
    recordView: feedModule.recordView,
    guestReact: feedModule.guestReact,
    guestRecordView: feedModule.guestRecordView,
    guestAddComment: feedModule.guestAddComment,
    deleteComment: feedModule.deleteComment,
    react: feedModule.react,
    toggleSave: feedModule.toggleSave,
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
    createLink: shareModule.createShareLink,
    revokeLink: shareModule.revokeShareLink,
    feed: shareModule.shareFeed,
    join: shareModule.joinShare,
    publicTokenForReel: shareModule.publicTokenForReel,
    reelShareLink: shareModule.reelShareLink,
    comments: shareModule.shareComments,
    evidence: shareModule.shareEvidence,
  },
  art: {
    paintReel: async (args: { reelId: string }) => {
      const response = await fetch('/api/art/paint', {
        method: 'POST',
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({ reelId: args.reelId }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Art painting failed' }));
        throw new Error(error.error || 'Art painting failed');
      }
      
      return await response.json();
    },
    paintStudy: async (args: { studyId: string }) => {
      const { data: reels, error } = await supabase
        .from('reels')
        .select('id')
        .eq('study_id', args.studyId)
        .eq('enabled', true)
        .is('footage', null);
      
      if (error) throw error;
      
      const headers = await jsonAuthHeaders();
      const results = await Promise.allSettled(
        (reels || []).map(reel => 
          fetch('/api/art/paint', {
            method: 'POST',
            headers,
            body: JSON.stringify({ reelId: reel.id }),
          })
        )
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      return { status: 'pending', queued: successful };
    },
  },
  footage: {
    library: footageModule.listLibrary,
    saveUpload: footageModule.saveUpload,
    setReelFootage: footageModule.setReelFootage,
    removeUpload: footageModule.removeUpload,
    listClips: async (args: { reelId: string }) => {
      const { data: reel } = await supabase
        .from("reels")
        .select("workspace_id")
        .eq("id", args.reelId)
        .single();
      if (!reel) return [...footageModule.STOCK_CLIPS];
      const library = await footageModule.listLibrary({ workspaceId: reel.workspace_id });
      return [...library.stock];
    },
    selectClip: async (args: { reelId: string; clipId: string }) => {
      return footageModule.setReelFootage({
        reelId: args.reelId,
        footage: { caption: "", source: { kind: "stock", url: args.clipId } },
      });
    },
  },
};

// Export types
export type API = typeof api;
