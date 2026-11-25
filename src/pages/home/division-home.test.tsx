import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/native-viewer-account-menu.tsx", () => ({
  default: () => <div data-testid="account-menu" />,
}));

import DivisionHomePage from "./division-home.tsx";

describe("DivisionHomePage", () => {
  afterEach(() => cleanup());

  it("renders five division pills linking to separate feeds", () => {
    render(
      <MemoryRouter>
        <DivisionHomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Pick a division/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CH 01.*Auto/i })).toHaveAttribute("href", "/d/auto");
    expect(screen.getByRole("link", { name: /CH 02.*GI/i })).toHaveAttribute("href", "/d/gi");
    expect(screen.getByRole("link", { name: /CH 03.*Wood/i })).toHaveAttribute("href", "/d/wood");
    expect(screen.getByRole("link", { name: /CH 04.*Marine/i })).toHaveAttribute("href", "/d/marine");
    expect(screen.getByRole("link", { name: /CH 05.*Website/i })).toHaveAttribute("href", "/d/website");
  });
});
