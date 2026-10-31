import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { CommentKind, ReactionKind } from "@/convex/schema/validators.ts";
import { useFeedMode } from "./feed-mode.ts";

/** Thrown when a guest closes the name prompt; callers ignore it quietly. */
export class GuestDismissed extends Error {}

/** Mode-aware reads for one reel (inactive mode is skipped). */
export function useReelComments(reelId: Id<"reels">) {
  const mode = useFeedMode();
  const member = useQuery(api.feed.comments, mode.kind === "member" ? { reelId } : "skip");
  const shared = useQuery(
    api.share.comments,
    mode.kind === "share" ? { token: mode.token, reelId, secret: mode.secret ?? undefined } : "skip",
  );
  return mode.kind === "member" ? member : shared;
}

export function useReelEvidence(reelId: Id<"reels">) {
  const mode = useFeedMode();
  const member = useQuery(api.feed.evidence, mode.kind === "member" ? { reelId } : "skip");
  const shared = useQuery(api.share.evidence, mode.kind === "share" ? { token: mode.token, reelId } : "skip");
  return mode.kind === "member" ? member : shared;
}

/** Mode-aware writes. Guest writes prompt for a name first. */
export function useFeedActions() {
  const mode = useFeedMode();
  const m = {
    react: useMutation(api.feed.setReaction),
    view: useMutation(api.feed.recordView),
    add: useMutation(api.feed.addComment),
    del: useMutation(api.feed.deleteComment),
  };
  const s = {
    react: useMutation(api.share.setReaction),
    view: useMutation(api.share.recordView),
    add: useMutation(api.share.addComment),
    del: useMutation(api.share.deleteComment),
  };

  const guestSecret = async (): Promise<string> => {
    if (mode.kind !== "share") throw new Error("Not a share feed");
    const secret = await mode.ensureGuest();
    if (!secret) throw new GuestDismissed();
    return secret;
  };

  return {
    react: async (reelId: Id<"reels">, kind: ReactionKind) => {
      if (mode.kind === "member") return void (await m.react({ reelId, kind }));
      await s.react({ token: mode.token, secret: await guestSecret(), reelId, kind });
    },
    recordView: async (reelId: Id<"reels">, completed: boolean) => {
      if (mode.kind === "member") return void (await m.view({ reelId, completed }));
      await s.view({ token: mode.token, secret: mode.secret ?? undefined, reelId, completed });
    },
    addComment: async (args: { reelId: Id<"reels">; kind: CommentKind; body: string; parentId?: Id<"comments"> }) => {
      if (mode.kind === "member") return void (await m.add(args));
      await s.add({ token: mode.token, secret: await guestSecret(), ...args });
    },
    deleteComment: async (commentId: Id<"comments">) => {
      if (mode.kind === "member") return void (await m.del({ commentId }));
      await s.del({ token: mode.token, secret: await guestSecret(), commentId });
    },
  };
}
