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

vi.mock("@/components/reel/reel-canvas.tsx", () => ({
  default: ({ reel }: { reel: { title: string } }) => <div>{reel.title}</div>,
}));

vi.mock("@/hooks/use-is-researcher.ts", () => ({
  useIsResearcher: () => ({ isResearcher: false, loading: false }),
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

  it("exposes only Add to PPT, Like, Comment, and Heard this before on the stream", () => {
    renderDemo();
    expect(screen.getAllByRole("button", { name: /add to ppt/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^like$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /open comments/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /heard this before/i }).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/open sources/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate powerpoint/i })).not.toBeInTheDocument();
  });

  it("likes and marks heard this before locally", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderDemo();

    const like = screen.getAllByRole("button", { name: /^like$/i })[0];
    await user.click(like);
    expect(like).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /^unlike$/i }));
    expect(screen.getAllByRole("button", { name: /^like$/i })[0]).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    const heard = screen.getAllByRole("button", { name: /heard this before/i })[0];
    await user.click(heard);
    expect(heard).toHaveAttribute("aria-pressed", "true");

    const productCalls = fetchSpy.mock.calls.filter(
      ([url]) => !String(url).includes("/analytics_events"),
    );
    expect(productCalls).toEqual([]);
    fetchSpy.mockRestore();
  });

  it("opens discussion with seeded comments and posts a local note", async () => {
    const user = userEvent.setup();
    renderDemo();

    await user.click(
      screen.getAllByRole("button", { name: /open comments/i })[0],
    );
    const sheet = await screen.findByRole("dialog", {
      name: /scene discussion/i,
    });
    expect(within(sheet).getByText(/too much food/i)).toBeInTheDocument();
    expect(within(sheet).getByText("Maya Chen")).toBeInTheDocument();

    await user.type(
      within(sheet).getByPlaceholderText(/ask a question or leave a note/i),
      "Can we try a 3-night plan?",
    );
    await user.click(within(sheet).getByRole("button", { name: /^post$/i }));

    expect(
      within(sheet).getByText("Can we try a 3-night plan?"),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("You")).toBeInTheDocument();
  });

  it("does not change scenes while typing in the comment box", async () => {
    const user = userEvent.setup();
    mockDesktop();
    renderDemo();

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
    expect(top).toBe(0);

    await user.keyboard("{Escape}");
    box.blur();
    await user.keyboard("j");
    await waitFor(() => {
      expect(top).toBe(800);
    });
  });

  it("hides researcher CTAs for signed-out / non-researcher visitors", async () => {
    mockDesktop();
    renderDemo();
    expect(screen.queryByRole("link", { name: /search these insights/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /insights dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /powerpoint deck/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^explore$/i })).not.toBeInTheDocument();
  });

  it("lets visitors add insights and generate a PowerPoint deck without signing in", async () => {
    const user = userEvent.setup();
    mockDesktop();
    renderDemo();

    expect(screen.queryByRole("button", { name: /generate powerpoint/i })).not.toBeInTheDocument();
    const add = screen.getAllByRole("button", { name: /add to ppt/i })[0];
    await user.click(add);
    expect(add).toHaveTextContent(/added to ppt/i);
    expect(screen.getByRole("button", { name: /generate powerpoint \(1\)/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /generate powerpoint \(1\)/i }));
    expect(await screen.findByRole("button", { name: /\.pptx|powerpoint/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/create a new version/i)).not.toBeInTheDocument();
  });
});
