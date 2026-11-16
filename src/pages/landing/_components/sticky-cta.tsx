import { useEffect, useState, type RefObject } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils.ts";
import { CtaLink } from "./cta.tsx";

/** Mobile-only bar that appears once the hero and final email CTAs are off-screen. */
export default function StickyCta({
  variant,
  hideWhen,
}: {
  variant: string;
  hideWhen: Array<RefObject<HTMLElement | null>>;
}) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const visible = new Map<Element, boolean>();
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      setShow(![...visible.values()].some(Boolean));
    });
    for (const ref of hideWhen) {
      if (ref.current) obs.observe(ref.current);
    }
    return () => obs.disconnect();
  }, [hideWhen]);

  if (user) return null;

  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 md:hidden",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <CtaLink location="sticky" variant={variant} className="w-full">
        Start free
      </CtaLink>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">Three studies free. No card.</p>
    </div>
  );
}
