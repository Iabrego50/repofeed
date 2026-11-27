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

const submitDemoRequest = vi.fn();
vi.mock("@/lib/demo-request.ts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/demo-request.ts")>("@/lib/demo-request.ts");
  return {
    ...actual,
    submitDemoRequest: (...args: unknown[]) => submitDemoRequest(...args),
  };
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

function clickPrimary(name: RegExp) {
  // Prefer the slop primary CTA when the visual also exposes the same accessible name.
  const matches = screen.getAllByRole("button", { name });
  const primary = matches.find((el) => el.className.includes("slop-btn-primary")) ?? matches[0]!;
  fireEvent.click(primary);
}

async function advanceToDemo() {
  clickPrimary(/^Keep watching$/i);
  clickPrimary(/^Change the channel$/i);
  clickPrimary(/^I'd rather not dig$/i);
  clickPrimary(/Set up a demo/i);
}

async function advanceToBuild() {
  await advanceToDemo();
  submitDemoRequest.mockResolvedValue(undefined);
  fireEvent.change(screen.getByLabelText(/Work email/i), { target: { value: "you@company.com" } });
  fireEvent.click(screen.getByRole("button", { name: /Set up my demo/i }));
  await vi.waitFor(() => {
    expect(screen.getByRole("button", { name: /Build my channel/i })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: /Build my channel/i }));
}

describe("StoryOnboarding", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    submitDemoRequest.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the first narrative beat and advances with Keep watching", () => {
    render(wrap(<StoryOnboarding preview />));
    expect(screen.getByRole("heading", { name: /Remember 8pm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip the story/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Keep watching$/i }));
    expect(screen.getByRole("heading", { name: /Then everyone got their own screen/i })).toBeInTheDocument();
  });

  it("skips early beats to the demo step", () => {
    render(wrap(<StoryOnboarding preview />));
    fireEvent.click(screen.getByRole("button", { name: /Skip the story/i }));
    expect(screen.getByRole("heading", { name: /Want this with your research/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skip the story/i })).not.toBeInTheDocument();
  });

  it("shows validation error and success on the demo form", async () => {
    render(wrap(<StoryOnboarding preview />));
    fireEvent.click(screen.getByRole("button", { name: /Skip the story/i }));
    fireEvent.click(screen.getByRole("button", { name: /Set up my demo/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn.t look like an email/i);

    submitDemoRequest.mockResolvedValue(undefined);
    fireEvent.change(screen.getByLabelText(/Work email/i), { target: { value: "you@company.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Set up my demo/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Thanks — we’ll email you@company.com/i);
    });
    expect(submitDemoRequest).toHaveBeenCalledWith("you@company.com");
    expect(screen.getByRole("button", { name: /Build my channel/i })).toBeInTheDocument();
    expect(screen.getByText(/What you get/i)).toBeInTheDocument();
    expect(screen.getByText(/The iOS app streams your insights/i)).toBeInTheDocument();
    expect(screen.queryByText(/never leave your servers/i)).not.toBeInTheDocument();
  });

  it("walks the four build-channel substeps and restores role on Back", async () => {
    render(wrap(<StoryOnboarding preview />));
    await advanceToBuild();
    expect(screen.getByRole("heading", { name: /Who's holding the remote/i })).toBeInTheDocument();
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);

    expect(screen.getByRole("heading", { name: /What goes on air/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Interviews$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByRole("heading", { name: /Who's watching/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^My team$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByRole("heading", { name: /Name the channel/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Put it on air/i }));
    expect(screen.getByRole("heading", { name: /You're on air/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("heading", { name: /Name the channel/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("heading", { name: /Who's watching/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("heading", { name: /What goes on air/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("heading", { name: /Who's holding the remote/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Researcher$/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows pricing plans on the sign-up finish step for preview visitors", async () => {
    render(wrap(<StoryOnboarding preview />));
    await advanceToBuild();
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Interviews$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^My team$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Put it on air/i }));
    expect(screen.getByRole("heading", { name: /You're on air/i })).toBeInTheDocument();
    expect(screen.getByText(/^Plans$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Start free$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Start 14-day trial/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Learn more/i })).toHaveAttribute("href", "/landing");
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeVisible();
  });

  it("shows a Back control on every step after the first", () => {
    render(wrap(<StoryOnboarding preview />));
    expect(screen.queryByRole("button", { name: /^Back$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Keep watching$/i }));
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
  });
});
