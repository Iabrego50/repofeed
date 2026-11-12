import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoExplorePage from "./page.tsx";

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

function renderExplore(path = "/demo/explore") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <DemoExplorePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Demo explore", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists sample insights and updates matches as you type", async () => {
    const user = userEvent.setup();
    renderExplore();
    expect(screen.getByRole("heading", { name: /search the sample study/i })).toBeInTheDocument();
    expect(screen.getByText(/help that became homework/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/ask a question or search/i), "homework");
    await waitFor(() => {
      expect(screen.getByText(/insight matches|insights match/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /help that became homework/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /why people really leave/i })).not.toBeInTheDocument();
  });

  it("filters the library when a topic is pressed", async () => {
    const user = userEvent.setup();
    renderExplore();
    const topics = screen.getAllByRole("button", { name: /personalization/i });
    await user.click(topics[0]);
    await waitFor(() => {
      expect(screen.getByText(/about Personalization/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /it never learned me/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /help that became homework/i })).not.toBeInTheDocument();
  });

  it("answers a suggested question from the sample insights without calling the Ask API", async () => {
    const user = userEvent.setup();
    renderExplore();
    await user.click(screen.getByRole("button", { name: /what do people say about price/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /answer from your research/i })).toBeInTheDocument();
    });
    const answer = screen.getByRole("region", { name: /answer from your research/i });
    expect(within(answer).getByText(/29%/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /why people really leave/i })).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
