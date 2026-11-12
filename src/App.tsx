import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AppErrorBoundary } from "./components/app-error-boundary.tsx";
import SpaAnalytics from "./components/spa-analytics.tsx";
import AppLayout from "./components/app-layout.tsx";
import PublicEntry from "./pages/landing/public-entry.tsx";
import DocumentMeta from "./components/document-meta.tsx";
import Logo from "./components/logo.tsx";
import { Spinner } from "./components/ui/spinner.tsx";
import { FEED_PATH, signInPath } from "./app-paths.ts";

const AuthCallback = lazy(() => import("./pages/auth/Callback.tsx"));
const SignInPage = lazy(() => import("./pages/auth/signin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Welcome = lazy(() => import("./pages/welcome/page.tsx"));
const InvitePage = lazy(() => import("./pages/invite/page.tsx"));
const SharePage = lazy(() => import("./pages/share/page.tsx"));
const Landing = lazy(() => import("./pages/landing/page.tsx"));
const DemoPage = lazy(() => import("./pages/demo/page.tsx"));
const ExplorePage = lazy(() => import("./pages/explore/page.tsx"));
const DemoDeckPage = lazy(() => import("./pages/demo/deck/page.tsx"));
const DemoInsightsPage = lazy(() => import("./pages/demo/insights/page.tsx"));
const FeedPage = lazy(() => import("./pages/feed/page.tsx"));
const StudiesPage = lazy(() => import("./pages/studies/page.tsx"));
const NewStudyPage = lazy(() => import("./pages/studies/new/page.tsx"));
const StudyPage = lazy(() => import("./pages/studies/detail/page.tsx"));
const InsightsPage = lazy(() => import("./pages/insights/page.tsx"));
const DeckPage = lazy(() => import("./pages/insights/deck/page.tsx"));
const SettingsPage = lazy(() => import("./pages/settings/page.tsx"));
const BillingPage = lazy(() => import("./pages/billing/page.tsx"));
const HelpPage = lazy(() => import("./pages/help/page.tsx"));
const TermsPage = lazy(() => import("./pages/legal/terms.tsx"));
const PrivacyPage = lazy(() => import("./pages/legal/privacy.tsx"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/analytics.tsx"));

function PageLoader() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

function ShellOutlet() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
      <Logo />
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={FEED_PATH} replace />;
  return <>{children}</>;
}

/** Signed-in users with no workspace go to onboarding. */
function RequireWorkspace() {
  const { workspaces, loading } = useWorkspace();
  if (loading || workspaces === undefined) return <FullScreenLoader />;
  if (workspaces.length === 0) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

/**
 * `/help` stays public when signed out (help center). `/` is registered
 * outside this gate so the marketing landing is always public.
 * Every other nested route sends signed-out visitors to sign-in.
 */
function Gate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    if (location.pathname === "/help") {
      return <PublicEntry loader={<FullScreenLoader />} />;
    }
    return <Navigate to={signInPath(`${location.pathname}${location.search}`)} replace />;
  }
  return <Outlet />;
}

export default function App() {
  useServiceWorker();
  return (
    <AppErrorBoundary>
      <DefaultProviders>
        <BrowserRouter>
          <DocumentMeta />
          <SpaAnalytics />
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/confirm" element={<AuthCallback />} />
              <Route
                path="/signin"
                element={
                  <GuestOnly>
                    <SignInPage />
                  </GuestOnly>
                }
              />
              <Route path="/login" element={<Navigate to="/signin" replace />} />
              <Route path="/auth" element={<Navigate to="/signin" replace />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/s/:token" element={<SharePage />} />
              <Route path="/share/:token" element={<SharePage />} />
              <Route path="/for/:slug" element={<Landing />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/demo/insights" element={<DemoInsightsPage />} />
              <Route path="/demo/deck" element={<DemoDeckPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/" element={<PublicEntry loader={<FullScreenLoader />} />} />
              <Route path="/dashboard" element={<Navigate to={FEED_PATH} replace />} />
              <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              <Route element={<Gate />}>
                <Route path="/welcome" element={<div className="h-dvh overflow-y-auto"><Welcome /></div>} />
                <Route element={<RequireWorkspace />}>
                  <Route path="/insights/deck" element={<DeckPage />} />
                  <Route element={<AppLayout />}>
                    <Route element={<ShellOutlet />}>
                      <Route path="/feed" element={<FeedPage />} />
                      <Route path="/studies" element={<StudiesPage />} />
                      <Route path="/studies/new" element={<NewStudyPage />} />
                      <Route path="/studies/:studyId" element={<StudyPage />} />
                      <Route path="/explore" element={<ExplorePage />} />
                      <Route path="/insights" element={<InsightsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/billing" element={<BillingPage />} />
                      <Route path="/help" element={<HelpPage />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DefaultProviders>
    </AppErrorBoundary>
  );
}
