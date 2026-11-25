import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StoryOnboarding from "./story-onboarding.tsx";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false, isLoading: false }),
}));

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({ workspaces: [], loading: false, current: null, refresh: async () => [] }),
}));

vi.mock("@/hooks/use-reduced-motion.ts", () => ({
  useReducedMotion: () => true,
}));

describe("StoryOnboarding", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the first narrative beat and advances with Continue", () => {
    render(
      <MemoryRouter>
        <StoryOnboarding preview />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Everyone watched the same story at 8pm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: /Streaming shattered the shared screen/i })).toBeInTheDocument();
  });

  it("requires a role chip before leaving the question step", () => {
    render(
      <MemoryRouter>
        <StoryOnboarding preview />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByRole("heading", { name: /What’s your role/i })).toBeInTheDocument();
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    expect(continueBtn).not.toBeDisabled();
  });
});
