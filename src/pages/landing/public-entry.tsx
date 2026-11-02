import { lazy, Suspense } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { api } from "@/lib/api/complete";
import PublicShell from "@/components/public-shell.tsx";
import Landing from "./page.tsx";

const HelpPage = lazy(() => import("@/pages/help/page.tsx"));

/**
 * Signed-out visitors opening a member reel link (`/?reel=…`) go to the public,
 * no-sign-up version when the study's sharing is on. `/help` shows the public Help Center.
 * Everyone else sees the landing page.
 */
export default function PublicEntry({ loader }: { loader: React.ReactNode }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const reelId = params.get("reel");
  
  const { data: token } = useQuery({
    queryKey: ['share', 'publicTokenForReel', reelId],
    queryFn: () => api.share.publicTokenForReel!({ reelId: reelId! }),
    enabled: !!reelId,
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
  if (!reelId) return <Landing />;
  if (token === undefined) return <>{loader}</>;
  if (token) return <Navigate to={`/s/${token}?reel=${encodeURIComponent(reelId)}`} replace />;
  return <Landing />;
}
