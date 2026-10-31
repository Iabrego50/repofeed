import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import AppLayout from "./components/app-layout.tsx";
import LandingPage from "./pages/landing/public-entry.tsx";
import StudiesPage from "./pages/studies/page.tsx";
import StudyDetailPage from "./pages/studies/detail/page.tsx";
import NewStudyPage from "./pages/studies/new/page.tsx";
import FeedPage from "./pages/feed/page.tsx";
import InsightsPage from "./pages/insights/page.tsx";
import InsightsDeckPage from "./pages/insights/deck/page.tsx";
import BillingPage from "./pages/billing/page.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import WelcomePage from "./pages/welcome/page.tsx";
import InvitePage from "./pages/invite/page.tsx";
import SharePage from "./pages/share/page.tsx";
import PrivacyPage from "./pages/legal/privacy.tsx";
import TermsPage from "./pages/legal/terms.tsx";
import Logo from "./components/logo.tsx";
import { Spinner } from "./components/ui/spinner.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function FullScreenLoader() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
      <Logo />
      <Spinner className="size-6 text-primary" />
    </div>
  );
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function UnauthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/feed" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UnauthenticatedRoute><LandingPage loader={<FullScreenLoader />} /></UnauthenticatedRoute>} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route element={<AuthenticatedRoute><AppLayout /></AuthenticatedRoute>}>
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/studies" element={<StudiesPage />} />
            <Route path="/studies/new" element={<NewStudyPage />} />
            <Route path="/studies/:id" element={<StudyDetailPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/insights/deck" element={<InsightsDeckPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
