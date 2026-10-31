import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import NotFound from "./pages/NotFound.tsx";
import PublicEntry from "./pages/landing/public-entry.tsx";
import AppLayout from "./components/app-layout.tsx";
import Logo from "./components/logo.tsx";
import { Spinner } from "./components/ui/spinner.tsx";
import { useWorkspace } from "./hooks/use-workspace.ts";
import { WorkspaceProvider } from "./components/providers/workspace.tsx";
import { useServiceWorker } from "./hooks/use-service-worker.ts";
import { hasStoredSession } from "./lib/stored-session.ts";

// Each page downloads only when first visited, so the first load stays small.
const Welcome = lazy(() => import("./pages/welcome/page.tsx"));
const InvitePage = lazy(() => import("./pages/invite/page.tsx"));
const SharePage = lazy(() => import("./pages/share/page.tsx"));
const DemoPage = lazy(() => import("./pages/demo/page.tsx"));
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

function PageLoader() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

/** Inside the app shell, so the sidebar stays put while a page downloads. */
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

/** Signed-in users with no workspace go to onboarding. */
function RequireWorkspace() {
  const { workspaces } = useWorkspace();
  if (workspaces === undefined) return <FullScreenLoader />;
  if (workspaces.length === 0) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

function Gate() {
  // Visitors with no saved sign-in see the homepage at once instead of a spinner.
  const signedOutVisitor = !hasStoredSession();
  return (
    <>
      <AuthLoading>
        {signedOutVisitor ? <PublicEntry loader={<FullScreenLoader />} /> : <FullScreenLoader />}
      </AuthLoading>
      <Unauthenticated>
        <PublicEntry loader={<FullScreenLoader />} />
      </Unauthenticated>
      <Authenticated>
        <Outlet />
      </Authenticated>
    </>
  );
}

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <WorkspaceProvider>
        <BrowserRouter>
          <Suspense fallback={<FullScreenLoader />}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/s/:token" element={<SharePage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/demo/insights" element={<DemoInsightsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route element={<Gate />}>
              <Route path="/welcome" element={<div className="h-dvh overflow-y-auto"><Welcome /></div>} />
              <Route element={<RequireWorkspace />}>
                <Route path="/insights/deck" element={<DeckPage />} />
                <Route element={<AppLayout />}>
                  <Route element={<ShellOutlet />}>
                    <Route path="/" element={<FeedPage />} />
                    <Route path="/studies" element={<StudiesPage />} />
                    <Route path="/studies/new" element={<NewStudyPage />} />
                    <Route path="/studies/:studyId" element={<StudyPage />} />
                    <Route path="/insights" element={<InsightsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/help" element={<HelpPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </WorkspaceProvider>
    </DefaultProviders>
  );
}
