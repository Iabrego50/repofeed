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
  
  // Stub for share comments
  const { data: sharedComments } = useQuery({
    queryKey: ['share', 'comments', mode.kind === 'share' ? mode.token : null, reelId],
    queryFn: async () => [],
    enabled: mode.kind === "share",
  });
  
  return mode.kind === "member" ? memberComments : sharedComments;
}

export function useReelEvidence(reelId: string) {
  const mode = useFeedMode();
  
  // Stub for evidence - will need to be implemented
  const { data: memberEvidence } = useQuery({
    queryKey: ['feed', 'evidence', reelId],
    queryFn: async () => [],
    enabled: mode.kind === "member",
  });
  
  const { data: sharedEvidence } = useQuery({
    queryKey: ['share', 'evidence', mode.kind === 'share' ? mode.token : null, reelId],
    queryFn: async () => [],
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
      // Stub: reactions not yet implemented
      console.log('Reaction not yet implemented', reelId, kind);
    },
    recordView: async (reelId: string, completed: boolean) => {
      // Stub: view tracking not yet implemented
      console.log('View recording not yet implemented', reelId, completed);
    },
    addComment: async (args: { reelId: string; kind: CommentKind; body: string; parentId?: string }) => {
      if (mode.kind === "member") {
        await api.feed.addComment(args);
      } else {
        // Stub: guest comments not yet implemented
        const secret = await guestSecret();
        console.log('Guest comment not yet implemented', mode.token, secret, args);
      }
    },
    deleteComment: async (commentId: string) => {
      // Stub: delete comment not yet implemented
      console.log('Delete comment not yet implemented', commentId);
    },
  };
}
