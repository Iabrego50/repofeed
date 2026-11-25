import { Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { hasCompletedStoryOnboarding } from "@/lib/story-onboarding.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import StoryOnboarding from "@/components/story-onboarding/story-onboarding.tsx";
import WorkspaceSetup from "./workspace-setup.tsx";

/**
 * `/welcome` serves:
 * 1. Public story preview (signed out).
 * 2. First-run story for signed-in accounts (including iOS).
 * 3. Workspace setup after the story on web (`?setup=1`).
 * Native viewers go to `/join` for the short code after the story.
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

  if (!user) {
    return <StoryOnboarding preview />;
  }

  const storyDone = hasCompletedStoryOnboarding(user);

  if (forceStory || (!storyDone && !forceSetup)) {
    return <StoryOnboarding replay={forceStory && storyDone} />;
  }

  // iOS viewers: short code, not workspace creation.
  if (nativeViewerMode) {
    if ((workspaces?.length ?? 0) === 0) {
      return <Navigate to="/join" replace />;
    }
    return <Navigate to={appHomePath()} replace />;
  }

  return (
    <div className="h-dvh overflow-y-auto">
      <WorkspaceSetup />
    </div>
  );
}
