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
import WorkspaceSetup from "./workspace-setup.tsx";

/**
 * `/welcome` serves:
 * 1. Web: public story preview (signed out) + first-run story + workspace setup.
 * 2. Native: viewer-only onboarding (no pricing / researcher signup), then `/join`.
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

  if (forceStory || (!storyDone && !forceSetup)) {
    return <StoryOnboarding replay={forceStory && storyDone} />;
  }

  return (
    <div className="h-dvh overflow-y-auto">
      <WorkspaceSetup />
    </div>
  );
}
