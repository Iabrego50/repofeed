import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ViewerOnboarding from "./viewer-onboarding.tsx";
import { VIEWER_ONBOARDING_DONE_KEY } from "@/lib/story-onboarding.ts";

describe("ViewerOnboarding", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("walks through viewer steps and lands on join without pricing", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Routes>
          <Route path="/welcome" element={<ViewerOnboarding />} />
          <Route path="/join" element={<div>Join code entry</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Your team’s research plays here/i })).toBeInTheDocument();
    expect(screen.queryByText(/Start 14-day trial|Pricing|Pro/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("heading", { name: /Scroll\. React\. Ask/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("heading", { name: /Enter the join code/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Enter join code/i }));
    expect(screen.getByText(/Join code entry/i)).toBeInTheDocument();
    expect(localStorage.getItem(VIEWER_ONBOARDING_DONE_KEY)).toBe("1");
  });

  it("shows Back after the first step and restores the previous step", async () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Routes>
          <Route path="/welcome" element={<ViewerOnboarding />} />
          <Route path="/join" element={<div>Join code entry</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /^Back$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("heading", { name: /Scroll\. React\. Ask/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("heading", { name: /Your team’s research plays here/i })).toBeInTheDocument();
    });
  });
});
