import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

/**
 * Page chrome from Isaac’s Claude redesign artboards:
 * `.slop-scope.slop-grid-bg` + ambient orbs + content layer.
 * Web-only redesign surfaces wrap in this; iOS viewer onboarding stays separate.
 */
export default function SlopShell({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "slop-scope slop-grid-bg relative flex min-h-dvh flex-col overflow-hidden",
        className,
      )}
      data-slop-level="3"
    >
      <div className="slop-orb-layer absolute inset-0" aria-hidden>
        <div className="slop-orb slop-orb-purple" />
        <div className="slop-orb slop-orb-cyan" />
        <div className="slop-orb slop-orb-pink" />
        <div className="slop-orb slop-orb-emerald" />
      </div>
      <div className={cn("slop-content-layer relative z-10 flex min-h-0 flex-1 flex-col", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function SlopBrand({ className }: { className?: string }) {
  return (
    <span className={cn("slop-brand", className)}>
      <span className="slop-brand-mark" aria-hidden>
        ✨
      </span>
      <span>
        repofeed<span style={{ color: "#94a3b8" }}>.ai</span>
      </span>
    </span>
  );
}

export function SlopPill({
  children,
  dot = "purple",
}: {
  children: ReactNode;
  dot?: "purple" | "pink" | "cyan" | "emerald" | "amber" | "red" | "green";
}) {
  return (
    <div className="slop-pill slop-pill-shimmer" style={{ marginBottom: 0 }}>
      <span className={`slop-dot slop-dot-${dot}`} />
      <span className="slop-sparkle">{children}</span>
    </div>
  );
}
