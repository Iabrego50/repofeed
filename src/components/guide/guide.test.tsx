import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { LESSONS } from "@/lib/guide.ts";
import { Tour } from "./guide.tsx";

function renderTour(path: string, onClose: (finished: boolean) => void) {
  const router = createMemoryRouter(
    [{ path: "*", element: <Tour lesson={LESSONS[0]} publishedStudyId={null} onClose={onClose} /> }],
    { initialEntries: [path] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

describe("guided tour overlay", () => {
  it("keeps the dimming layer non-modal so sidebar and bottom nav stay clickable", async () => {
    const onClose = vi.fn();
    renderTour("/feed", onClose);

    await waitFor(() => {
      expect(document.querySelector("[data-guide-layer]")).toHaveClass("pointer-events-none");
    });
    expect(document.querySelector("[data-guide-backdrop]")).toHaveClass("pointer-events-none");
    expect(document.querySelector("[data-guide-card]")).toHaveClass("pointer-events-auto");
  });

  it("dismisses on Escape and on outside click without leaving an overlay mounted", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <>
              <button type="button">Outside</button>
              <Tour lesson={LESSONS[0]} publishedStudyId={null} onClose={onClose} />
            </>
          ),
        },
      ],
      { initialEntries: ["/feed"] },
    );
    const { unmount } = render(<RouterProvider router={router} />);

    expect(await screen.findByRole("dialog", { name: /feed is what your team sees/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith(false);

    onClose.mockClear();
    // Remount a fresh tour for the outside-click path
    unmount();
    const onClose2 = vi.fn();
    const router2 = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <>
              <button type="button">Outside</button>
              <Tour lesson={LESSONS[0]} publishedStudyId={null} onClose={onClose2} />
            </>
          ),
        },
      ],
      { initialEntries: ["/feed"] },
    );
    const second = render(<RouterProvider router={router2} />);
    expect(await screen.findByRole("dialog", { name: /feed is what your team sees/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(onClose2).toHaveBeenCalledWith(false);

    second.unmount();
    expect(document.querySelector("[data-guide-layer]")).toBeNull();
    expect(document.querySelector("[data-guide-backdrop]")).toBeNull();
  });

  it("closes when the route changes away from the current stop", async () => {
    const onClose = vi.fn();
    const { router } = renderTour("/feed", onClose);

    await waitFor(() => {
      expect(document.querySelector("[data-guide-card]")).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      await router.navigate("/billing");
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith(false);
    });
  });
});
