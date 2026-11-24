import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DeckSelectionProvider, useDeckSelection, useRequiredDeckSelection } from "./deck-selection.ts";

function Probe() {
  const deck = useRequiredDeckSelection();
  return (
    <div>
      <span data-testid="count">{deck.count}</span>
      <button type="button" onClick={() => deck.toggle("a")}>
        toggle-a
      </button>
      <button type="button" onClick={() => deck.toggle("b")}>
        toggle-b
      </button>
      <button type="button" onClick={() => deck.clear()}>
        clear
      </button>
      <span data-testid="a">{deck.isSelected("a") ? "yes" : "no"}</span>
    </div>
  );
}

function OptionalProbe() {
  const deck = useDeckSelection();
  return <span data-testid="optional">{deck ? "ready" : "missing"}</span>;
}

describe("DeckSelectionProvider", () => {
  afterEach(() => cleanup());

  it("toggles and clears selected insight ids", async () => {
    const user = userEvent.setup();
    render(
      <DeckSelectionProvider>
        <Probe />
      </DeckSelectionProvider>,
    );

    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("a")).toHaveTextContent("no");

    await user.click(screen.getByRole("button", { name: "toggle-a" }));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("a")).toHaveTextContent("yes");

    await user.click(screen.getByRole("button", { name: "toggle-b" }));
    expect(screen.getByTestId("count")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "toggle-a" }));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("a")).toHaveTextContent("no");

    await user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("returns null outside the provider", () => {
    render(<OptionalProbe />);
    expect(screen.getByTestId("optional")).toHaveTextContent("missing");
  });
});
