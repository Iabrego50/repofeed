import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/logo.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import { LEGAL_LAST_UPDATED } from "@/lib/site.ts";

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

/** Shared layout for the Terms and Privacy pages. */
export default function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-dvh overflow-y-auto bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="repofeed.ai home" className="cursor-pointer">
          <Logo />
        </Link>
        <Link to="/" className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">
        <p className="text-sm font-medium text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
        <p className="mt-6 leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.heading} aria-labelledby={`legal-${i}`}>
              <h2 id={`legal-${i}`} className="text-xl font-bold">
                {i + 1}. {s.heading}
              </h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">{p}</p>
              ))}
              {s.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground marker:text-primary">
                  {s.bullets.map((b) => (
                    <li key={b} className="leading-relaxed">{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
