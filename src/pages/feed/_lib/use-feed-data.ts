import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import type { CommentKind, ReactionType } from "@/schema/validators.ts";
import { useFeedMode } from "./feed-mode.ts";

/** Thrown when a guest closes the name prompt; callers ignore it quietly. */
export class GuestDismissed extends Error {}

/** Mode-aware reads for one reel (inactive mode is skipped). */
export function useReelComments(reelId: string, enabled = true) {
  const mode = useFeedMode();

  const { data: memberComments } = useQuery({
    queryKey: ["feed", "comments", reelId],
    queryFn: () => api.feed.getComments({ reelId }),
    enabled: enabled && mode.kind === "member",
  });

  // Share viewers are watch-only — no comment panel, so skip the guest comments RPC.
  return mode.kind === "member" ? memberComments : undefined;
}

export function useReelEvidence(reelId: string, enabled = true) {
  const mode = useFeedMode();

  const { data: memberEvidence } = useQuery({
    queryKey: ["feed", "evidence", reelId],
    queryFn: () => api.feed.getEvidence({ reelId }),
    enabled: enabled && mode.kind === "member",
  });

  return mode.kind === "member" ? memberEvidence : undefined;
}

/** Mode-aware writes. Share-link viewers never write. */
export function useFeedActions() {
  const mode = useFeedMode();

  const rejectShareWrite = () => {
    throw new Error("Share-link viewers can only watch");
  };

  return {
    react: async (reelId: string, kind: ReactionType) => {
      if (mode.kind === "share") return rejectShareWrite();
      return api.feed.react({ reelId, kind });
    },
    recordView: async (reelId: string, completed: boolean, sessionId?: string) => {
      if (mode.kind === "share") return;
      await api.feed.recordView({ reelId, completed, sessionId });
    },
    addComment: async (args: {
      reelId: string;
      kind: CommentKind;
      body: string;
      parentId?: string;
    }) => {
      if (mode.kind === "share") return rejectShareWrite();
      await api.feed.addComment(args);
    },
    deleteComment: async (commentId: string) => {
      if (mode.kind === "share") return rejectShareWrite();
      await api.feed.deleteComment({ commentId });
    },
  };
}
