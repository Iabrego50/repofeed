import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { COMPANY_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site.ts";

const LINKS = [
  { to: "/demo", label: "Demo" },
  { to: "/demo/insights", label: "Insights demo" },
  { to: "/help", label: "Help Center" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/privacy", label: "Privacy Policy" },
];

const LINK_CLASS = "cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground";

/** Public footer with legal links and the support contact. */
export default function SiteFooter() {
  return (
    <footer className="relative border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Link to="/" aria-label={`${COMPANY_NAME} home`} className="inline-block cursor-pointer">
            <Logo />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">Research, as a feed. Short, cited scenes your team actually watches.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={LINK_CLASS}>
              {l.label}
            </Link>
          ))}
          <a href={SUPPORT_MAILTO} className={`${LINK_CLASS} flex items-center gap-1.5`}>
            <Mail className="size-4" /> {SUPPORT_EMAIL}
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
      </p>
    </footer>
  );
}
