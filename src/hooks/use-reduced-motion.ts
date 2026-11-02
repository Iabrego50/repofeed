import { useEffect, useState } from "react";

function mediaQuery(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query);
}

/** Tracks the user's prefers-reduced-motion setting. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => mediaQuery("(prefers-reduced-motion: reduce)")?.matches ?? false);
  useEffect(() => {
    const mq = mediaQuery("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
