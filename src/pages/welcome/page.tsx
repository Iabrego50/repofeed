import { Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { hasCompletedStoryOnboarding, hasCompletedViewerOnboarding } from "@/lib/story-onboarding.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { isNativePlatform } from "@/lib/native";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import StoryOnboarding from "@/components/story-onboarding/story-onboarding.tsx";
import ViewerOnboarding from "@/components/viewer-onboarding/viewer-onboarding.tsx";

/**
 * `/welcome` serves:
 * 1. Web: public story preview (signed out) + first-run Slopstrap story + channel build.
 * 2. Native: viewer-only onboarding (no pricing / researcher signup), then `/join`.
 *
 * Signed-in users with no workspace stay in the Slopstrap flow (story → build channel →
 * on air → upload). The old “About you” workspace-setup UI is gone.
 */
export default function WelcomePage() {
  const { user, isLoading } = useAuth();
  const { nativeViewerMode, loading: viewerLoading } = useNativeViewer();
  const { workspaces, loading: workspacesLoading } = useWorkspace();
  const [params] = useSearchParams();
  const forceStory = params.get("story") === "1";
  const forceSetup = params.get("setup") === "1";

  if (isLoading || viewerLoading || (user && workspacesLoading)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // iOS / Capacitor: short viewer onboarding, never the researcher story with pricing.
  if (isNativePlatform()) {
    if (forceStory || !hasCompletedViewerOnboarding()) {
      return <ViewerOnboarding />;
    }
    if ((workspaces?.length ?? 0) === 0 || nativeViewerMode) {
      return <Navigate to="/join" replace />;
    }
    return <Navigate to={appHomePath()} replace />;
  }

  if (!user) {
    return <StoryOnboarding preview />;
  }

  const storyDone = hasCompletedStoryOnboarding(user);
  const hasWorkspace = (workspaces?.length ?? 0) > 0;

  // Replay: full story from the start.
  if (forceStory) {
    return <StoryOnboarding replay={storyDone} />;
  }

  // Signed-in, no workspace: Slopstrap story → channel → on air → upload.
  // If they already finished the narrative (or deep-linked ?setup=1), start at role.
  if (!hasWorkspace) {
    const startAt = storyDone || forceSetup ? "role" : undefined;
    return <StoryOnboarding startAt={startAt} />;
  }

  // Has a workspace — feed is home; story only via ?story=1.
  return <Navigate to={appHomePath()} replace />;
}
