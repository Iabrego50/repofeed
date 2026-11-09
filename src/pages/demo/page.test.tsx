import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoPage from "./page.tsx";
import { HINT_STORAGE_KEY } from "./_lib/demo-interactions.ts";

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: ({ reel }: { reel: { title: string } }) => <div>{reel.title}</div>,
}));

function renderDemo() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/demo"]}>
        <DemoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockDesktop() {
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
}

describe("Demo feed interactions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    });
    cleanup();
  });

  it("hearts and saves a scene locally and updates counts", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderDemo();

    const react = screen.getAllByRole("button", { name: /^react$/i })[0];
    expect(react).toHaveTextContent("9");
    await user.click(react);
    expect(react).toHaveAttribute("aria-pressed", "true");
    expect(react).toHaveTextContent("10");
    await user.click(screen.getByRole("button", { name: /remove reaction/i }));
    expect(react).toHaveTextContent("9");

    const save = screen.getAllByRole("button", { name: /save scene/i })[0];
    await user.click(save);
    expect(save).toHaveAttribute("aria-pressed", "true");
    expect(save).toHaveAccessibleName(/remove from saved/i);

    const productCalls = fetchSpy.mock.calls.filter(
      ([url]) => !String(url).includes("/analytics_events"),
    );
    expect(productCalls).toEqual([]);
    expect(
      fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/analytics_events") &&
          String((init as { body?: string })?.body).includes('"event":"heart"'),
      ),
    ).toBe(true);
    fetchSpy.mockRestore();
  });

  it("opens discussion with seeded comments and posts a local note", async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(
      screen.getAllByRole("button", { name: /open comments/i })[0],
    );
    const sheet = await screen.findByRole("dialog", {
      name: /scene discussion and evidence/i,
    });
    expect(within(sheet).getByText(/too much food/i)).toBeInTheDocument();
    expect(within(sheet).getByText("Maya Chen")).toBeInTheDocument();
    expect(
      within(sheet).getByText(/price is still the top reason/i),
    ).toBeInTheDocument();
    expect(within(sheet).getByText(/3-night SKU/i)).toBeInTheDocument();

    await user.type(
      within(sheet).getByPlaceholderText(/ask a question or leave a note/i),
      "Can we try a 3-night plan?",
    );
    await user.click(within(sheet).getByRole("button", { name: /^post$/i }));

    expect(
      within(sheet).getByText("Can we try a 3-night plan?"),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("You")).toBeInTheDocument();
    expect(
      within(sheet).getByText(/in your workspace, your team sees this/i),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("link", { name: /make your own, free/i }),
    ).toHaveAttribute("href", "/signin");
  });

  it("shows the scene's findings and source files in evidence", async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(
      screen.getAllByRole("button", { name: /open sources/i })[0],
    );
    const sheet = await screen.findByRole("dialog", {
      name: /scene discussion and evidence/i,
    });
    expect(
      within(sheet).getByRole("tab", { name: /evidence/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(within(sheet).getByText("29%")).toBeInTheDocument();
    expect(within(sheet).getByText("Source files")).toBeInTheDocument();
    expect(
      within(sheet).getByText("supperly-churn-survey.csv"),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("On-screen script")).toBeInTheDocument();
  });

  it("does not change scenes while typing in the comment box", async () => {
    const user = userEvent.setup();
    mockDesktop();
    renderDemo();

    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.getByText("Maya Chen")).toBeInTheDocument();

    const scroller = screen.getByLabelText(/demo scene feed/i);
    let top = 0;
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    scroller.scrollTo = ((options?: ScrollToOptions | number) => {
      top = typeof options === "number" ? options : (options?.top ?? 0);
      scroller.dispatchEvent(new Event("scroll"));
    }) as typeof scroller.scrollTo;

    const box = screen.getByPlaceholderText(/ask a question or leave a note/i);
    await user.click(box);
    await user.keyboard("jk");
    await user.keyboard("{ArrowDown}");

    expect(box).toHaveValue("jk");
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(top).toBe(0);

    await user.keyboard("{Escape}");
    box.blur();
    await user.keyboard("j");
    await waitFor(() => {
      expect(screen.getByText("2 / 10")).toBeInTheDocument();
    });
  });

  it("shows first-scene coach marks and remembers dismissing them", async () => {
    const user = userEvent.setup();
    renderDemo();

    expect(
      await screen.findByRole("button", { name: /got it/i }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/react if this rings true/i)).toBeInTheDocument();
    expect(screen.getByText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByText(/see the evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/scroll for the next scene/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /got it/i }));
    expect(
      screen.queryByRole("button", { name: /got it/i }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(HINT_STORAGE_KEY)).toBe("1");

    cleanup();
    renderDemo();
    await new Promise((r) => setTimeout(r, 1000));
    expect(
      screen.queryByRole("button", { name: /got it/i }),
    ).not.toBeInTheDocument();
  });
});
