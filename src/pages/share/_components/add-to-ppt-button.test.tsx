import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DeckSelectionProvider } from "../_lib/deck-selection.ts";
import AddToPptButton from "./add-to-ppt-button.tsx";

describe("AddToPptButton", () => {
  afterEach(() => cleanup());

  it("renders nothing without a selection provider", () => {
    const { container } = render(<AddToPptButton reelId="r1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("toggles between Add to PPT and Added to PPT", async () => {
    const user = userEvent.setup();
    render(
      <DeckSelectionProvider>
        <AddToPptButton reelId="r1" />
      </DeckSelectionProvider>,
    );

    const btn = screen.getByRole("button", { name: /add to ppt/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("Add to PPT");

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAccessibleName(/remove from powerpoint/i);
    expect(btn).toHaveTextContent("Added to PPT");

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("Add to PPT");
  });
});
