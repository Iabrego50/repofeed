import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SceneActions from "./scene-actions";

const noop = () => undefined;

describe("SceneActions", () => {
  it("hides Save when onSave is omitted (share-link viewer)", () => {
    render(
      <SceneActions
        onHeart={noop}
        onComment={noop}
        onEvidence={noop}
      />,
    );
    expect(screen.queryByLabelText(/save scene/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/react/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/open comments/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/open sources/i)).toBeInTheDocument();
  });

  it("shows Save for signed-in members", () => {
    render(
      <SceneActions
        onHeart={noop}
        onComment={noop}
        onEvidence={noop}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/save scene/i)).toBeInTheDocument();
  });
});
