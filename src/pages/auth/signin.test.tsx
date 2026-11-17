import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bag = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    signIn: bag.signIn,
    signInWithOtp: bag.signInWithOtp,
    verifyEmailOtp: bag.verifyEmailOtp,
  }),
}));

import SignInPage from "./signin";

async function requestCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/work email/i), "person@example.com");
  await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));
  await waitFor(() => expect(bag.signInWithOtp).toHaveBeenCalledWith("person@example.com"));
  return screen.findByLabelText(/sign-in code from your email/i);
}

describe("Sign in", () => {
  beforeEach(() => {
    bag.signIn.mockReset();
    bag.signInWithOtp.mockReset();
    bag.verifyEmailOtp.mockReset();
    bag.signInWithOtp.mockResolvedValue(undefined);
    bag.verifyEmailOtp.mockResolvedValue(undefined);
  });

  it("hides Google unless VITE_ENABLE_GOOGLE_AUTH is true", () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.getByText(/email you a link/i)).toBeInTheDocument();
  });

  it("lets someone type an 8-digit email code and auto-submits", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    const codeInput = await requestCode(user);
    expect(codeInput).toHaveAttribute("autocomplete", "one-time-code");
    expect(codeInput).toHaveAttribute("maxlength", "8");
    expect(screen.getByRole("button", { name: /resend/i })).toBeDisabled();

    await user.type(codeInput, "40567273");
    await waitFor(() => expect(bag.verifyEmailOtp).toHaveBeenCalledWith("person@example.com", "40567273"));
  });

  it("accepts a 6-digit code when Verify is pressed, without auto-submit", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    const codeInput = await requestCode(user);
    await user.type(codeInput, "123456");
    expect(bag.verifyEmailOtp).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /verify code/i }));
    await waitFor(() => expect(bag.verifyEmailOtp).toHaveBeenCalledWith("person@example.com", "123456"));
  });

  it("strips spaces and dashes when pasting a code", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    const codeInput = await requestCode(user);
    await user.click(codeInput);
    await user.paste("4056-7273");
    await waitFor(() => expect(bag.verifyEmailOtp).toHaveBeenCalledWith("person@example.com", "40567273"));
  });

  it("shows a send error without leaving the email form", async () => {
    bag.signInWithOtp.mockRejectedValue(new Error("Rate limit"));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/work email/i), "person@example.com");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));
    expect(await screen.findByText("Rate limit")).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/sign-in code from your email/i)).not.toBeInTheDocument();
  });
});
