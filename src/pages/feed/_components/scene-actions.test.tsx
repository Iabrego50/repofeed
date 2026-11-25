import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SceneActions from "./scene-actions";

const noop = () => undefined;

describe("SceneActions", () => {
  it("only exposes Like, Comment, and Heard this before", () => {
    render(
      <SceneActions
        onLike={noop}
        onComment={noop}
        onHeardBefore={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /^like$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open comments/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /heard this before/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/open sources/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/copy link/i)).not.toBeInTheDocument();
  });

  it("reflects pressed state for Like and Heard this before", () => {
    render(
      <SceneActions
        liked
        heardBefore
        onLike={vi.fn()}
        onComment={noop}
        onHeardBefore={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^unlike$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /remove heard this before/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
