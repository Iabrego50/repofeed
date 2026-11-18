import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import type { Comment } from "@/lib/api/mappers";
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

/** Mode-aware writes. Guests join (name prompt) before comment/react; delete stays member-only. */
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
        return api.feed.react({ reelId, kind });
      }
      const secret = await guestSecret();
      return api.feed.guestReact({ reelId, kind, token: mode.token, secret });
    },
    recordView: async (reelId: string, completed: boolean, sessionId?: string) => {
      // Don't prompt for a name just to record a view.
      if (mode.kind === "share") return;
      await api.feed.recordView({ reelId, completed, sessionId });
    },
    addComment: async (args: {
      reelId: string;
      kind: CommentKind;
      body: string;
      parentId?: string;
    }): Promise<Comment | void> => {
      if (mode.kind === "member") {
        await api.feed.addComment(args);
        return;
      }
      const secret = await guestSecret();
      return api.feed.guestAddComment({ ...args, token: mode.token, secret });
    },
    deleteComment: async (commentId: string) => {
      if (mode.kind === "share") {
        throw new Error("Share-link viewers can only watch");
      }
      await api.feed.deleteComment({ commentId });
    },
  };
}
