import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from "@/lib/api/complete";
import type { CommentKind, ReactionType } from "@/schema/validators.ts";
import { useFeedMode } from "./feed-mode.ts";

/** Thrown when a guest closes the name prompt; callers ignore it quietly. */
export class GuestDismissed extends Error {}

/** Mode-aware reads for one reel (inactive mode is skipped). */
export function useReelComments(reelId: string) {
  const mode = useFeedMode();
  
  const { data: memberComments } = useQuery({
    queryKey: ['feed', 'comments', reelId],
    queryFn: () => api.feed.comments({ reelId }),
    enabled: mode.kind === "member",
  });
  
  const { data: sharedComments } = useQuery({
    queryKey: ['share', 'comments', mode.kind === 'share' ? mode.token : null, reelId],
    queryFn: () => api.share.comments!({ token: mode.kind === 'share' ? mode.token : '', reelId, secret: mode.kind === 'share' ? mode.secret : undefined }),
    enabled: mode.kind === "share",
  });
  
  return mode.kind === "member" ? memberComments : sharedComments;
}

export function useReelEvidence(reelId: string) {
  const mode = useFeedMode();
  
  const { data: memberEvidence } = useQuery({
    queryKey: ['feed', 'evidence', reelId],
    queryFn: () => api.feed.evidence!({ reelId }),
    enabled: mode.kind === "member",
  });
  
  const { data: sharedEvidence } = useQuery({
    queryKey: ['share', 'evidence', mode.kind === 'share' ? mode.token : null, reelId],
    queryFn: () => api.share.evidence!({ token: mode.kind === 'share' ? mode.token : '', reelId }),
    enabled: mode.kind === "share",
  });
  
  return mode.kind === "member" ? memberEvidence : sharedEvidence;
}

/** Mode-aware writes. Guest writes prompt for a name first. */
export function useFeedActions() {
  const mode = useFeedMode();
  
  const guestSecret = async (): Promise<string> => {
    if (mode.kind !== "share") throw new Error("Not a share feed");
    const secret = await mode.ensureGuest();
    if (!secret) throw new GuestDismissed();
    return secret;
  };

  return {
    react: async (reelId: string, kind: ReactionType) => {
      if (mode.kind === "member") {
        // Member reaction - implement via API
        console.log('Member reaction not yet implemented', reelId, kind);
      } else {
        // Guest reaction - implement via share API
        const secret = await guestSecret();
        console.log('Guest reaction not yet implemented', mode.token, secret, reelId, kind);
      }
    },
    recordView: async (reelId: string, completed: boolean) => {
      if (mode.kind === "member") {
        // Member view - implement via API
        console.log('Member view not yet implemented', reelId, completed);
      } else {
        // Guest view - implement via share API
        console.log('Guest view not yet implemented', mode.token, reelId, completed);
      }
    },
    addComment: async (args: { reelId: string; kind: CommentKind; body: string; parentId?: string }) => {
      if (mode.kind === "member") {
        await api.feed.addComment(args);
      } else {
        const secret = await guestSecret();
        // Guest comment - implement via share API
        console.log('Guest comment not yet implemented', mode.token, secret, args);
      }
    },
    deleteComment: async (commentId: string) => {
      if (mode.kind === "member") {
        // Member delete - implement via API
        console.log('Member delete comment not yet implemented', commentId);
      } else {
        const secret = await guestSecret();
        // Guest delete - implement via share API
        console.log('Guest delete comment not yet implemented', mode.token, secret, commentId);
      }
    },
  };
}
