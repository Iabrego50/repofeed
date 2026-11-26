import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StoryOnboarding from "./story-onboarding.tsx";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false, isLoading: false }),
}));

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({ workspaces: [], loading: false, current: null, refresh: async () => [] }),
}));

vi.mock("@/hooks/use-native-viewer.ts", () => ({
  useNativeViewer: () => ({
    isAdmin: false,
    nativeViewerMode: false,
    nativeAdminAccess: false,
    loading: false,
    profile: null,
  }),
}));

vi.mock("@/hooks/use-reduced-motion.ts", () => ({
  useReducedMotion: () => true,
}));

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("StoryOnboarding", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the first narrative beat and advances with Turn it on", () => {
    render(wrap(<StoryOnboarding preview />));
    expect(screen.getByRole("heading", { name: /Remember 8pm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip the story/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Turn it on$/i }));
    expect(screen.getByRole("heading", { name: /Then everyone got their own screen/i })).toBeInTheDocument();
  });

  it("requires a role chip before leaving the channel setup step", () => {
    render(wrap(<StoryOnboarding preview />));
    fireEvent.click(screen.getByRole("button", { name: /^Turn it on$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Change the channel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^I'd rather not dig$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Build my channel$/i }));
    expect(screen.getByRole("heading", { name: /Who’s holding the remote/i })).toBeInTheDocument();
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);
    expect(screen.getByRole("heading", { name: /You're on air/i })).toBeInTheDocument();
  });

  it("shows pricing plans on the sign-up finish step for preview visitors", () => {
    render(wrap(<StoryOnboarding preview />));
    fireEvent.click(screen.getByRole("button", { name: /^Turn it on$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Change the channel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^I'd rather not dig$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Build my channel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: /You're on air/i })).toBeInTheDocument();
    expect(screen.getByText(/^Plans$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Start free$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Start 14-day trial/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Learn more/i })).toHaveAttribute("href", "/landing");
  });

  it("keeps role selection when going Back from the finish step", async () => {
    render(wrap(<StoryOnboarding preview />));
    fireEvent.click(screen.getByRole("button", { name: /^Turn it on$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Change the channel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^I'd rather not dig$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Build my channel$/i }));
    expect(screen.getByRole("heading", { name: /Who’s holding the remote/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    expect(screen.getByRole("button", { name: /^Researcher$/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: /You're on air/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("heading", { name: /Who’s holding the remote/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Researcher$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Continue/i })).not.toBeDisabled();
  });

  it("shows a Back control on every step after the first", () => {
    render(wrap(<StoryOnboarding preview />));
    expect(screen.queryByRole("button", { name: /^Back$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Turn it on$/i }));
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Change the channel$/i }));
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^I'd rather not dig$/i }));
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Build my channel$/i }));
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Founder$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
  });

  it("keeps the finish heading and plan CTAs reachable in the scrollable layout", () => {
    render(wrap(<StoryOnboarding preview />));
    fireEvent.click(screen.getByRole("button", { name: /^Turn it on$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Change the channel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^I'd rather not dig$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Build my channel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    const heading = screen.getByRole("heading", { name: /You're on air/i });
    expect(heading).toBeVisible();
    expect(screen.getByRole("button", { name: /^Start free$/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Watch the demo$/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeVisible();
  });
});
