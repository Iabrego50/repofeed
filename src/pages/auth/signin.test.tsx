import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signInWithOtp: vi.fn(),
  }),
}));

import SignInPage from "./signin";

describe("Sign in Google button", () => {
  it("hides Google unless VITE_ENABLE_GOOGLE_AUTH is true", () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.getByText(/use a magic link/i)).toBeInTheDocument();
  });
});
