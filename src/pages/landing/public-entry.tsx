import { lazy, Suspense } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { api } from "@/lib/api/complete";
import PublicShell from "@/components/public-shell.tsx";

const Landing = lazy(() => import("./page.tsx"));

const HelpPage = lazy(() => import("@/pages/help/page.tsx"));

/**
 * `/` is always the marketing landing, signed-in or not.
 * Signed-out visitors opening a member reel link (`/?reel=…`) go to the public,
 * no-sign-up version when the study's sharing is on. `/help` shows the public Help Center.
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
  if (!reelId) {
    return (
      <Suspense fallback={loader}>
        <Landing />
      </Suspense>
    );
  }
  if (token === undefined) return <>{loader}</>;
  if (token) return <Navigate to={`/s/${token}?reel=${encodeURIComponent(reelId)}`} replace />;
  return (
    <Suspense fallback={loader}>
      <Landing />
    </Suspense>
  );
}
