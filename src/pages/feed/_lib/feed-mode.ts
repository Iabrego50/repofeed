import { createContext, useContext } from "react";

/**
 * Where the feed's data comes from. Members use their account; share-link
 * visitors get a watch-only public feed keyed by the link token.
 */
export type FeedMode =
  | { kind: "member" }
  | {
      kind: "share";
      token: string;
    };

export const FeedModeContext = createContext<FeedMode>({ kind: "member" });

export function useFeedMode(): FeedMode {
  return useContext(FeedModeContext);
}
