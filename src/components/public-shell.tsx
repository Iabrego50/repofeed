import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/logo.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import { cn } from "@/lib/utils.ts";

/** Header and footer for public pages (legal, help, demo insights) shown to signed-out visitors. */
export default function PublicShell({ children, wide = false, actions }: { children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  const width = wide ? "max-w-6xl" : "max-w-3xl";
  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto bg-background">
      <header className={cn("mx-auto flex items-center justify-between gap-3 px-5 py-5", width)}>
        <Link to="/" aria-label="repofeed.ai home" className="cursor-pointer">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          {actions}
          <Link to="/" aria-label="Back" className="flex min-h-11 cursor-pointer items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Back</span>
          </Link>
        </div>
      </header>
      <main className={cn("mx-auto pb-20", width)}>{children}</main>
      <SiteFooter />
    </div>
  );
}
