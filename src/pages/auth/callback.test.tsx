import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bag = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  upsert: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getBrowserSupabase: () => ({
    auth: {
      verifyOtp: bag.verifyOtp,
      exchangeCodeForSession: bag.exchangeCodeForSession,
      getSession: bag.getSession,
    },
    from: () => ({ upsert: bag.upsert }),
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    signInWithOtp: bag.signInWithOtp,
  }),
}));

import AuthCallback from "./Callback";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/confirm" element={<AuthCallback />} />
        <Route path="/" element={<div>home</div>} />
        <Route path="/feed" element={<div>feed</div>} />
        <Route path="/studies" element={<div>studies</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthCallback token_hash and PKCE", () => {
  beforeEach(() => {
    bag.verifyOtp.mockReset();
    bag.exchangeCodeForSession.mockReset();
    bag.getSession.mockReset();
    bag.upsert.mockReset();
    bag.signInWithOtp.mockReset();
    bag.upsert.mockResolvedValue({ error: null });
  });

  it("verifies token_hash on /auth/confirm without exchanging a PKCE code", async () => {
    bag.verifyOtp.mockResolvedValue({ error: null });
    bag.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } },
      error: null,
    });
    renderAt("/auth/confirm?token_hash=abc&type=magiclink");
    await waitFor(() => expect(bag.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "magiclink" }));
    expect(bag.exchangeCodeForSession).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("feed")).toBeInTheDocument());
  });

  it("follows a safe returnTo instead of the default feed", async () => {
    bag.verifyOtp.mockResolvedValue({ error: null });
    bag.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } },
      error: null,
    });
    renderAt("/auth/confirm?token_hash=abc&type=magiclink&returnTo=%2Fstudies");
    await waitFor(() => expect(screen.getByText("studies")).toBeInTheDocument());
  });

  it("still exchanges a PKCE code on /auth/callback", async () => {
    bag.exchangeCodeForSession.mockResolvedValue({ error: null });
    bag.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } },
      error: null,
    });
    renderAt("/auth/callback?code=pkce-code");
    await waitFor(() => expect(bag.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code"));
    expect(bag.verifyOtp).not.toHaveBeenCalled();
  });

  it("shows a friendly resend form when the PKCE verifier is missing", async () => {
    bag.exchangeCodeForSession.mockResolvedValue({
      error: { message: "PKCE code verifier not found in storage" },
    });
    renderAt("/auth/callback?code=other-browser");
    await waitFor(() => {
      expect(screen.getByText(/different device or browser/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /email me a new link/i })).toBeInTheDocument();
    });
    await userEvent.type(screen.getByLabelText(/work email/i), "person@example.com");
    await userEvent.click(screen.getByRole("button", { name: /email me a new link/i }));
    await waitFor(() => expect(bag.signInWithOtp).toHaveBeenCalledWith("person@example.com"));
  });
});
