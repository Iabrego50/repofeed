import Logo from "@/components/logo.tsx";
import { cn } from "@/lib/utils.ts";

const STUDY_STEPS = [
  { key: "upload", label: "Upload" },
  { key: "scenes", label: "Scenes" },
  { key: "publish", label: "Publish" },
] as const;

export type StudyShellStep = (typeof STUDY_STEPS)[number]["key"];

/** Design chrome for screens 10–12: logo + 1 Upload / 2 Scenes / 3 Publish pills. */
export function StudyShell({
  step,
  children,
  className,
}: {
  step: StudyShellStep;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh bg-paper text-foreground", className)}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex flex-wrap gap-2" aria-label="Study steps">
          {STUDY_STEPS.map((s, i) => {
            const active = s.key === step;
            return (
              <span
                key={s.key}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                  active ? "bg-studio text-white" : "bg-secondary text-foreground/70",
                )}
              >
                {i + 1} {s.label}
              </span>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-4">{children}</main>
    </div>
  );
}
