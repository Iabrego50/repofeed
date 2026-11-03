import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import type { CommentKind, ReactionType } from "@/schema/validators.ts";
import { useFeedMode } from "./feed-mode.ts";

/** Thrown when a guest closes the name prompt; callers ignore it quietly. */
export class GuestDismissed extends Error {}

/** Mode-aware reads for one reel (inactive mode is skipped). */
export function useReelComments(reelId: string) {
  const mode = useFeedMode();

  const { data: memberComments } = useQuery({
    queryKey: ["feed", "comments", reelId],
    queryFn: () => api.feed.getComments({ reelId }),
    enabled: mode.kind === "member",
  });

  // Stub for share comments
  const { data: sharedComments } = useQuery({
    queryKey: [
      "share",
      "comments",
      mode.kind === "share" ? mode.token : null,
      reelId,
    ],
    queryFn: async () => [],
    enabled: mode.kind === "share",
  });

  return mode.kind === "member" ? memberComments : sharedComments;
}

export function useReelEvidence(reelId: string, enabled = true) {
  const mode = useFeedMode();

  const { data: memberEvidence } = useQuery({
    queryKey: ["feed", "evidence", reelId],
    queryFn: () => api.feed.getEvidence({ reelId }),
    enabled: enabled && mode.kind === "member",
  });

  const { data: sharedEvidence } = useQuery({
    queryKey: [
      "share",
      "evidence",
      mode.kind === "share" ? mode.token : null,
      reelId,
    ],
    queryFn: async () => [],
    enabled: enabled && mode.kind === "share",
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
        await api.feed.react({ reelId, kind });
      } else {
        const secret = await guestSecret();
        await api.feed.guestReact({ reelId, kind, token: mode.token, secret });
      }
    },
    recordView: async (reelId: string, completed: boolean) => {
      if (mode.kind === "member") {
        await api.feed.recordView({ reelId, completed });
      } else {
        const secret = await guestSecret();
        await api.feed.guestRecordView({
          reelId,
          completed,
          token: mode.token,
          secret,
        });
      }
    },
    addComment: async (args: {
      reelId: string;
      kind: CommentKind;
      body: string;
      parentId?: string;
    }) => {
      if (mode.kind === "member") {
        await api.feed.addComment(args);
      } else {
        const secret = await guestSecret();
        await api.feed.guestAddComment({ ...args, token: mode.token, secret });
      }
    },
    deleteComment: async (commentId: string) => {
      await api.feed.deleteComment({ commentId });
    },
  };
}
