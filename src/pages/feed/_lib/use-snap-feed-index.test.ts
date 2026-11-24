import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useSnapFeedIndex } from "./use-snap-feed-index";

function hook(maxIndex: number, el: HTMLDivElement) {
  return renderHook(() => {
    const ref = useRef<HTMLDivElement | null>(el);
    return useSnapFeedIndex(ref, maxIndex);
  });
}

describe("useSnapFeedIndex", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not change activeIdx on every scroll tick — only after settle", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientHeight", { value: 800, configurable: true });
    Object.defineProperty(el, "scrollTop", { value: 0, writable: true, configurable: true });

    const { result } = hook(5, el);
    expect(result.current.activeIdx).toBe(0);

    act(() => {
      el.scrollTop = 800;
      el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.activeIdx).toBe(0);

    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current.activeIdx).toBe(1);
  });

  it("commits immediately on scrollend", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientHeight", { value: 800, configurable: true });
    Object.defineProperty(el, "scrollTop", { value: 0, writable: true, configurable: true });

    const { result } = hook(5, el);
    act(() => {
      el.scrollTop = 1600;
      el.dispatchEvent(new Event("scroll"));
      el.dispatchEvent(new Event("scrollend"));
    });
    expect(result.current.activeIdx).toBe(2);
  });
});
