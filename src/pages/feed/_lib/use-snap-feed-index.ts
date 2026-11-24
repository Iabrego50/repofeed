import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Snap-feed index that only commits the "playing" slide after scroll settles.
 *
 * Updating React state on every scroll event (Math.round of scrollTop) remounts
 * neighbouring ReelCanvas trees mid-gesture and fights CSS scroll-snap — that
 * reads as jitter on both desktop wheel/trackpad and iOS touch.
 */
export function useSnapFeedIndex(
  scrollerRef: RefObject<HTMLDivElement | null>,
  /** Inclusive max index (e.g. reels.length for the caught-up slot). */
  maxIndex: number,
) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeRef = useRef(0);
  const scrollingRef = useRef(false);
  const settleTimer = useRef<number | null>(null);

  const commit = useCallback((idx: number) => {
    const next = Math.max(0, Math.min(maxIndex, idx));
    if (activeRef.current === next) return;
    activeRef.current = next;
    setActiveIdx(next);
  }, [maxIndex]);

  const indexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return activeRef.current;
    return Math.round(el.scrollTop / Math.max(1, el.clientHeight));
  }, [scrollerRef]);

  const scrollTo = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(maxIndex, i));
      el.scrollTo({ top: clamped * el.clientHeight, behavior });
      if (behavior === "auto") commit(clamped);
    },
    [scrollerRef, maxIndex, commit],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || maxIndex < 0) return;

    const clearSettle = () => {
      if (settleTimer.current != null) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
    };

    const settle = () => {
      clearSettle();
      scrollingRef.current = false;
      commit(indexFromScroll());
    };

    const onScroll = () => {
      scrollingRef.current = true;
      clearSettle();
      // Safari / older WebViews lack scrollend; debounce is the fallback.
      settleTimer.current = window.setTimeout(settle, 120);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", settle);
    return () => {
      clearSettle();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
    };
  }, [scrollerRef, maxIndex, commit, indexFromScroll]);

  // Keep the committed index in range when the feed shrinks (filters).
  useEffect(() => {
    if (activeRef.current > maxIndex) commit(maxIndex);
  }, [maxIndex, commit]);

  return {
    activeIdx,
    setActiveIdx: commit,
    scrollingRef,
    scrollTo,
    activeRef,
  };
}
