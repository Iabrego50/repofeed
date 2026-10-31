import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import FeedTour from "./feed-tour.tsx";

/**
 * Shows the tour on any app page until the user finishes or skips it, so new sign-ups
 * see it wherever they land. A missing user row (sync still running) counts as new.
 */
export default function OnboardingTour() {
  const { isEditor } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const me = useQuery(api.users.getCurrentUser, {});
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const replay = params.get("tour") === "1";
  const open = replay || (me !== undefined && !me?.onboardedAt);

  const close = () => {
    if (params.has("tour")) {
      const next = new URLSearchParams(params);
      next.delete("tour");
      setParams(next, { replace: true });
    }
    void completeOnboarding().catch(() => undefined);
  };

  return <FeedTour open={open} isEditor={isEditor} onDone={close} />;
}
