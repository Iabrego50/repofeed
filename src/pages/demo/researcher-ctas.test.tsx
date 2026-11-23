import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import DemoPage from "./page.tsx";

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: ({ reel }: { reel: { title: string } }) => <div>{reel.title}</div>,
}));

vi.mock("@/hooks/use-is-researcher.ts", () => ({
  useIsResearcher: () => ({ isResearcher: true, loading: false }),
}));

function renderDemo() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  window.matchMedia = (query: string) => ({
    matches: query.includes("min-width: 1024px"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Demo researcher CTAs", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Search / Insights / deck CTAs for researchers on desktop", () => {
    renderDemo();
    expect(screen.getAllByRole("link", { name: /search these insights/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /insights dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /powerpoint deck/i }).length).toBeGreaterThan(0);
  });
});
