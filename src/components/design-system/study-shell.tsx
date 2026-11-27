import SlopShell, { SlopBrand } from "@/components/slop/slop-shell.tsx";
import { cn } from "@/lib/utils.ts";

const STUDY_STEPS = [
  { key: "upload", label: "Upload" },
  { key: "scenes", label: "Scenes" },
  { key: "publish", label: "Publish" },
] as const;

export type StudyShellStep = (typeof STUDY_STEPS)[number]["key"];

/** Slop chrome for Upload / Scenes / Publish (design screens 08–11). */
export function StudyShell({
  step,
  children,
  className,
  signedIn = true,
}: {
  step: StudyShellStep;
  children: React.ReactNode;
  className?: string;
  signedIn?: boolean;
}) {
  return (
    <SlopShell className={cn("min-h-dvh", className)} contentClassName="min-h-0">
      <header className="slop-navbar relative z-20">
        <div className="slop-navbar-inner flex-wrap px-6 py-2">
          <SlopBrand />
          <div className="slop-row flex-wrap">
            {signedIn ? (
              <span className="slop-status">
                <span className="slop-dot slop-dot-green" />
                Signed in
              </span>
            ) : null}
            <ol className="slop-tabs m-0 list-none" aria-label="Progress">
              {STUDY_STEPS.map((s, i) => {
                const active = s.key === step;
                return (
                  <li
                    key={s.key}
                    className={cn("slop-tab", active && "is-active")}
                    aria-current={active ? "step" : undefined}
                    style={{ cursor: "default", color: active ? "#ffffff" : undefined }}
                  >
                    {i + 1} {s.label}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-6 py-8 lg:px-16 lg:py-10">
        {children}
      </main>
    </SlopShell>
  );
}
