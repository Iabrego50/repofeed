import { createContext, useContext } from "react";

/**
 * Where the feed's data comes from. Members use their account; share-link
 * guests use the link token plus a per-browser secret once they've named themselves.
 */
export type FeedMode =
  | { kind: "member" }
  | {
      kind: "share";
      token: string;
      secret: string | null;
      /** Resolves with the guest secret, asking for a name first if needed. Null if dismissed. */
      ensureGuest: () => Promise<string | null>;
    };

export const FeedModeContext = createContext<FeedMode>({ kind: "member" });

export function useFeedMode(): FeedMode {
  return useContext(FeedModeContext);
}
