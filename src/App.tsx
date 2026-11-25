import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import { useNativeApp } from "@/hooks/use-native-app.ts";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AppErrorBoundary } from "./components/app-error-boundary.tsx";
import SpaAnalytics from "./components/spa-analytics.tsx";
import AppLayout from "./components/app-layout.tsx";
import PublicEntry from "./pages/landing/public-entry.tsx";
import DocumentMeta from "./components/document-meta.tsx";
import Logo from "./components/logo.tsx";
import { Spinner } from "./components/ui/spinner.tsx";
import { EXPLORE_PATH, FEED_PATH, signInPath } from "./app-paths.ts";
import { appHomePath } from "./lib/native-access.ts";
import { DIVISION_HOME_PATH } from "./lib/divisions.ts";
import { resolveReturnTo } from "./pages/auth/return-to.ts";
import { isNativePlatform } from "@/lib/native";
import { useIsResearcher } from "@/hooks/use-is-researcher.ts";
import { hasCompletedStoryOnboarding } from "@/lib/story-onboarding.ts";

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
const DemoExplorePage = lazy(() => import("./pages/demo/explore/page.tsx"));
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
const JoinPage = lazy(() => import("./pages/join/page.tsx"));
const DivisionHomePage = lazy(() => import("./pages/home/division-home.tsx"));
const DivisionFeedPage = lazy(() => import("./pages/home/division-feed.tsx"));
/** Design fixtures only — tree-shaken out of production unless VITE_DESIGN_HARNESS=true. */
const designHarnessEnabled =
  import.meta.env.DEV || import.meta.env.VITE_DESIGN_HARNESS === "true";
const DesignHarnessPage = designHarnessEnabled
  ? lazy(() => import("./pages/design-harness/page.tsx"))
  : null;

function PageLoader() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

function ShellOutlet() {
  const { pathname } = useLocation();
  // Keep the sidebar outside this boundary so a page crash does not kill nav.
  return (
    <AppErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AppErrorBoundary>
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
  const [params] = useSearchParams();
  const raw = resolveReturnTo({ returnTo: params.get("returnTo") });
  // On native, /feed and /explore deep-links land on the division home.
  const returnTo =
    isNativePlatform() && (raw === FEED_PATH || raw.startsWith(`${FEED_PATH}?`) || raw === EXPLORE_PATH)
      ? DIVISION_HOME_PATH
      : isNativePlatform() && raw === "/"
        ? DIVISION_HOME_PATH
        : raw;
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={returnTo} replace />;
  return <>{children}</>;
}

/** Signed-in users with no workspace go to onboarding (or join on native non-admins). */
function RequireWorkspace() {
  const { workspaces, loading } = useWorkspace();
  const { nativeViewerMode, loading: adminLoading } = useNativeViewer();
  if (loading || workspaces === undefined || (isNativePlatform() && adminLoading)) {
    return <FullScreenLoader />;
  }
  if (workspaces.length === 0) {
    return <Navigate to={nativeViewerMode ? "/join" : "/welcome"} replace />;
  }
  return <Outlet />;
}

/** Deck/editor routes: blocked for everyone on native; web members stay on feed. */
function EditorsOnly() {
  const { isEditor, loading, current } = useWorkspace();
  const { isResearcher, loading: researcherLoading } = useIsResearcher();
  if (isNativePlatform()) return <Navigate to={DIVISION_HOME_PATH} replace />;
  if (loading || researcherLoading || !current) return <FullScreenLoader />;
  if (!isEditor && !isResearcher) return <Navigate to={FEED_PATH} replace />;
  return <Outlet />;
}

/**
 * Insights, decks, and demo research tools: owners/editors or product admins.
 * Signed-out visitors and viewer (`member`) accounts are redirected away.
 */
function ResearchersOnly({ fallback }: { fallback: string }) {
  const { isResearcher, loading } = useIsResearcher();
  if (loading) return <FullScreenLoader />;
  if (!isResearcher) return <Navigate to={fallback} replace />;
  return <Outlet />;
}

/**
 * Native non-admins should not create workspaces in-app.
 * They may still open `/welcome` for the product story; WelcomePage sends them
 * to `/join` afterward when they have no team.
 */
function WelcomeGate({ children }: { children: React.ReactNode }) {
  const { loading } = useNativeViewer();
  if (isNativePlatform() && loading) return <FullScreenLoader />;
  return <>{children}</>;
}

/**
 * On native: Studies / Settings / Billing redirect to division home.
 * Division feeds and join stay reachable.
 */
function NativeExploreOnly() {
  if (isNativePlatform()) return <Navigate to={DIVISION_HOME_PATH} replace />;
  return <Outlet />;
}

/** Web keeps /feed; native sends /feed → division home. */
function FeedRoute() {
  if (isNativePlatform()) return <Navigate to={DIVISION_HOME_PATH} replace />;
  return <FeedPage />;
}

/**
 * Web: topic/search Explore library.
 * Native: division channel home (replaces the former merged scene feed).
 */
function ExploreRoute() {
  if (isNativePlatform()) return <Navigate to={DIVISION_HOME_PATH} replace />;
  return <ExplorePage />;
}

/** Public demo Insights/deck: on native, only division home remains. */
function NativeDemoRedirect({ to }: { to: string }) {
  if (isNativePlatform()) return <Navigate to={to} replace />;
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

/**
 * First sign-in (web + iOS): send accounts that have not finished the product
 * story to `/welcome`. `/welcome` and `/join` are excluded so those flows are
 * not interrupted.
 */
function StoryOnboardingGate() {
  const { user, loading } = useAuth();
  const { loading: viewerLoading } = useNativeViewer();
  const location = useLocation();

  if (loading || (isNativePlatform() && viewerLoading)) return <FullScreenLoader />;
  if (
    user &&
    !hasCompletedStoryOnboarding(user) &&
    location.pathname !== "/welcome" &&
    location.pathname !== "/join"
  ) {
    return <Navigate to="/welcome" replace />;
  }
  return <Outlet />;
}

function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <AppErrorBoundary resetKey={pathname}>{children}</AppErrorBoundary>;
}

function NativeShell() {
  useNativeApp();
  return null;
}

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <BrowserRouter>
        <NativeShell />
        <RouteErrorBoundary>
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
              <Route element={<ResearchersOnly fallback="/demo" />}>
                <Route element={<NativeDemoRedirect to={DIVISION_HOME_PATH} />}>
                  <Route path="/demo/insights" element={<DemoInsightsPage />} />
                  <Route path="/demo/deck" element={<DemoDeckPage />} />
                </Route>
                <Route path="/demo/explore" element={<DemoExplorePage />} />
              </Route>
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/" element={<PublicEntry loader={<FullScreenLoader />} />} />
              <Route path="/dashboard" element={<Navigate to={appHomePath()} replace />} />
              <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              {/* DEV / VITE_DESIGN_HARNESS fixture screens — no auth, no DB writes; omitted from prod builds. */}
              {DesignHarnessPage ? (
                <>
                  <Route path="/__design" element={<DesignHarnessPage />} />
                  <Route path="/__design/:screen" element={<DesignHarnessPage />} />
                </>
              ) : null}
              {/* Public story preview + first-run / workspace setup. Outside Gate so founders can open /welcome signed out. */}
              <Route
                path="/welcome"
                element={
                  <WelcomeGate>
                    <Welcome />
                  </WelcomeGate>
                }
              />
              <Route element={<Gate />}>
                <Route element={<StoryOnboardingGate />}>
                  <Route path="/join" element={<div className="h-dvh overflow-y-auto"><JoinPage /></div>} />
                  <Route element={<RequireWorkspace />}>
                    <Route element={<EditorsOnly />}>
                      <Route path="/insights/deck" element={<DeckPage />} />
                    </Route>
                    {/* Native division shell — no AppLayout chrome */}
                    <Route
                      path="/home"
                      element={
                        <div className="h-dvh overflow-hidden">
                          <Suspense fallback={<FullScreenLoader />}>
                            <DivisionHomePage />
                          </Suspense>
                        </div>
                      }
                    />
                    <Route
                      path="/d/:division"
                      element={
                        <div className="h-dvh overflow-hidden">
                          <Suspense fallback={<FullScreenLoader />}>
                            <DivisionFeedPage />
                          </Suspense>
                        </div>
                      }
                    />
                    <Route element={<AppLayout />}>
                      <Route element={<ShellOutlet />}>
                        <Route path="/feed" element={<FeedRoute />} />
                        <Route path="/explore" element={<ExploreRoute />} />
                        <Route path="/help" element={<HelpPage />} />
                        <Route element={<NativeExploreOnly />}>
                          <Route path="/settings" element={<SettingsPage />} />
                          <Route path="/studies" element={<StudiesPage />} />
                          <Route path="/studies/new" element={<NewStudyPage />} />
                          <Route path="/studies/:studyId" element={<StudyPage />} />
                          <Route element={<ResearchersOnly fallback={FEED_PATH} />}>
                            <Route path="/insights" element={<InsightsPage />} />
                          </Route>
                          <Route path="/billing" element={<BillingPage />} />
                        </Route>
                      </Route>
                    </Route>
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </BrowserRouter>
    </DefaultProviders>
  );
}
