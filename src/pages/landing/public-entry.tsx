import { lazy, Suspense } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { useAuth } from "@/lib/auth";
import { isNativePlatform } from "@/lib/native";
import { appHomePath } from "@/lib/native-access.ts";
import { EXPLORE_PATH, LANDING_PATH, signInPath } from "@/app-paths.ts";
import PublicShell from "@/components/public-shell.tsx";
import {
  hasCompletedGuestStory,
  hasCompletedViewerOnboarding,
  shouldShowWebStory,
} from "@/lib/story-onboarding.ts";

const Landing = lazy(() => import("./page.tsx"));
const HelpPage = lazy(() => import("@/pages/help/page.tsx"));
const ViewerOnboarding = lazy(() => import("@/components/viewer-onboarding/viewer-onboarding.tsx"));

/**
 * `/` entry:
 * - Native: short viewer onboarding → join / division home (no marketing, no pricing).
 * - Web signed-out (new): product story at `/welcome`.
 * - Web signed-out (story done): marketing `/landing`.
 * - Web signed-in: app home.
 * Reel deep-links still resolve to the public share feed when sharing is on.
 */
export default function PublicEntry({ loader }: { loader: React.ReactNode }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const reelId = params.get("reel");
  const { user, loading: authLoading } = useAuth();

  const { data: token } = useQuery({
    queryKey: ["share", "publicTokenForReel", reelId],
    queryFn: () => api.share.publicTokenForReel!({ reelId: reelId! }),
    enabled: !!reelId && !isNativePlatform(),
  });

  if (pathname === "/help") {
    return (
      <PublicShell>
        <Suspense fallback={loader}>
          <HelpPage />
        </Suspense>
      </PublicShell>
    );
  }

  if (pathname === LANDING_PATH) {
    return (
      <Suspense fallback={loader}>
        <Landing />
      </Suspense>
    );
  }

  // Native app: viewer onboarding first, then join / channels — never the marketing site.
  if (isNativePlatform()) {
    if (!hasCompletedViewerOnboarding()) {
      return (
        <Suspense fallback={loader}>
          <ViewerOnboarding />
        </Suspense>
      );
    }
    if (authLoading) return <>{loader}</>;
    if (user) return <Navigate to={EXPLORE_PATH} replace />;
    return <Navigate to={signInPath("/join")} replace />;
  }

  if (reelId) {
    if (token === undefined) return <>{loader}</>;
    if (token) return <Navigate to={`/s/${token}?reel=${encodeURIComponent(reelId)}`} replace />;
  }

  if (authLoading) return <>{loader}</>;

  if (user) {
    return <Navigate to={appHomePath()} replace />;
  }

  if (shouldShowWebStory(user)) {
    return <Navigate to="/welcome" replace />;
  }

  if (hasCompletedGuestStory()) {
    return <Navigate to={LANDING_PATH} replace />;
  }

  return <Navigate to="/welcome" replace />;
}
