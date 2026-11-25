import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hasCompletedStoryOnboarding } from "@/lib/story-onboarding.ts";
import StoryOnboarding from "@/components/story-onboarding/story-onboarding.tsx";
import WorkspaceSetup from "./workspace-setup.tsx";

/**
 * `/welcome` serves three jobs:
 * 1. Public story preview (signed out) so the founder can demo the narrative.
 * 2. First-run story for signed-in accounts (once, via user_metadata flag).
 * 3. Workspace setup after the story (`?setup=1`), preserving the prior flow.
 *
 * Replay: `/welcome?story=1` from settings/help.
 */
export default function WelcomePage() {
  const { user, isLoading } = useAuth();
  const [params] = useSearchParams();
  const forceStory = params.get("story") === "1";
  const forceSetup = params.get("setup") === "1";

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated preview for founders and marketing.
  if (!user) {
    return <StoryOnboarding preview />;
  }

  const storyDone = hasCompletedStoryOnboarding(user);

  if (forceStory || (!storyDone && !forceSetup)) {
    return <StoryOnboarding replay={forceStory && storyDone} />;
  }

  return (
    <div className="h-dvh overflow-y-auto">
      <WorkspaceSetup />
    </div>
  );
}
