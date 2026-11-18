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

  const { data: shareComments } = useQuery({
    queryKey: ["share", "comments", mode.kind === "share" ? mode.token : null, reelId],
    queryFn: () => {
      if (mode.kind !== "share") throw new Error("Not a share session");
      return api.share.comments({ token: mode.token, reelId });
    },
    enabled: enabled && mode.kind === "share" && !!reelId,
  });

  if (mode.kind === "member") return memberComments;
  if (mode.kind === "share") return shareComments;
  return undefined;
}

export function useReelEvidence(reelId: string, enabled = true) {
  const mode = useFeedMode();

  const { data: memberEvidence } = useQuery({
    queryKey: ["feed", "evidence", reelId],
    queryFn: () => api.feed.getEvidence({ reelId }),
    enabled: enabled && mode.kind === "member",
  });

  const { data: shareEvidence } = useQuery({
    queryKey: ["share", "evidence", mode.kind === "share" ? mode.token : null, reelId],
    queryFn: () => {
      if (mode.kind !== "share") throw new Error("Not a share session");
      return api.share.evidence({ token: mode.token, reelId });
    },
    enabled: enabled && mode.kind === "share" && !!reelId,
  });

  if (mode.kind === "member") return memberEvidence;
  if (mode.kind === "share") return shareEvidence;
  return undefined;
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
