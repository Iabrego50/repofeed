import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Logo from "@/components/logo.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils.ts";
import { CtaLink, HeroSignup } from "./_components/cta.tsx";
import Faq from "./_components/faq.tsx";
import HeroDevice from "./_components/hero-device.tsx";
import SampleFeed from "./_components/sample-feed.tsx";
import StickyCta from "./_components/sticky-cta.tsx";
import PricingSection from "./pricing-section.tsx";
import PrivacySection from "./privacy-section.tsx";
import { variantFor } from "./variants.ts";

const SHELL = "mx-auto max-w-6xl px-5";
const EYEBROW = "font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase";
const H2 = "max-w-[22ch] text-balance text-[2rem] font-bold tracking-tight leading-[1.02] sm:text-[2.75rem]";
const LEAD = "mt-4 max-w-[58ch] text-lg leading-relaxed text-muted-foreground";
const FREE_NOTE = "Free for your first three studies. No card, no password.";

const TRUST = [
  { title: "Files stay on your computer", body: "Your browser reads them. Only the text is sent." },
  { title: "Every quote is checked", body: "Word for word, against the file it came from." },
  { title: "Viewers need no account", body: "They open a link and watch. Viewers are free." },
  { title: "You see what landed", body: "Who watched, who finished, who pushed back." },
];

const STEPS = [
  {
    title: "Drop in what you already have",
    body: "Interview transcripts, survey exports, diary notes, last quarter’s deck. PDF, Word, PowerPoint, Excel, CSV and plain text all work.",
  },
  {
    title: "Review the scenes it drafts",
    body: "Each finding becomes a scene of ten to twenty seconds: the hook, the quote, the number, the takeaway. Edit the wording, swap the footage, or switch a scene off.",
  },
  {
    title: "Send one private link",
    body: "Your team opens it on a phone or laptop and starts scrolling. Nobody creates an account, and nobody needs training.",
  },
];

const COMPARE: Array<{ topic: string; usual: string; ours: string }> = [
  {
    topic: "Getting research in",
    usual: "Import it, then tag and code it by hand",
    ours: "Upload the files. Scenes are drafted for you to review.",
  },
  {
    topic: "Who can use it",
    usual: "Researchers. Everyone else needs a seat and a walkthrough.",
    ours: "Anyone with the link. Watching needs no account.",
  },
  {
    topic: "How findings travel",
    usual: "Someone has to remember to go and search",
    ours: "New scenes land in the feed, unwatched ones first",
  },
  {
    topic: "Proof behind a claim",
    usual: "A tag that links to a highlight",
    ours: "The quote, checked word for word, one tap from the scene",
  },
  {
    topic: "Knowing it landed",
    usual: "Page views, if anything",
    ours: "Who watched, who finished, and where they pushed back",
  },
  {
    topic: "What you pay for",
    usual: "Often a seat for every reader, or a sales call",
    ours: "Editors only. Viewers are free.",
  },
];

const INSIGHT_ROWS: Array<[string, string, number, number]> = [
  ["Why people really leave", "89%", 9, 2],
  ["The hidden cancel button", "100%", 10, 1],
  ["Fewer nights, please", "71%", 3, 5],
  ["Pause would have saved them", "93%", 7, 0],
];

function Nav({ variant, focused }: { variant: string; focused: boolean }) {
  const { user } = useAuth();
  const link =
    "hidden min-h-10 cursor-pointer items-center rounded-md px-3 text-[0.9375rem] font-medium text-muted-foreground hover:text-foreground sm:flex";
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-2.5">
        <Link to="/landing" aria-label="repofeed.ai home" className="cursor-pointer">
          <Logo />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1">
          {!focused && (
            <>
              <Link to="/demo" onClick={() => track("demo_open", { location: "nav" })} className={link}>
                Demo
              </Link>
              <a href="#pricing" className={link}>
                Pricing
              </a>
            </>
          )}
          {user ? (
            <CtaLink location="nav" variant={variant} to="/feed" className="h-10 px-4 text-sm">
              Go to your feed
            </CtaLink>
          ) : (
            <>
              <Link
                to="/signin"
                className="flex min-h-10 cursor-pointer items-center rounded-md px-3 text-[0.9375rem] font-medium text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <CtaLink location="nav" variant={variant} className="h-10 px-4 text-sm">
                Start free
              </CtaLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function Landing() {
  const { slug } = useParams();
  const variant = variantFor(slug);
  const focused = !!variant.slug;
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [hideWhen] = useState(() => [heroCtaRef, finalCtaRef]);

  useEffect(() => {
    track("landing_view", { variant: variant.slug || "home" });
  }, [variant.slug]);

  return (
    <div className="landing min-h-dvh bg-paper max-md:pb-24">
      <Nav variant={variant.slug} focused={focused} />

      <main>
        <section className={cn(SHELL, "grid items-center gap-x-10 gap-y-14 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-16")}>
          <div>
            <p className={EYEBROW}>Research, on air</p>
            <h1 className="title-card mt-3 max-w-[13ch] text-[3.25rem] sm:text-[4.5rem] lg:text-[5.25rem]">{variant.headline}</h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">{variant.sub}</p>
            <div ref={heroCtaRef} className="mt-8">
              <HeroSignup variant={variant.slug} />
              <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                {FREE_NOTE}{" "}
                <Link
                  to="/demo"
                  onClick={() => track("demo_open", { location: "hero_text" })}
                  className="cursor-pointer font-medium whitespace-nowrap text-foreground underline underline-offset-4"
                >
                  Watch the demo first
                </Link>
              </p>
            </div>
          </div>
          <HeroDevice />
        </section>

        <section aria-labelledby="trust-heading" className="border-y border-border bg-card">
          <h2 id="trust-heading" className="sr-only">
            What you can count on
          </h2>
          <div className={cn(SHELL, "grid divide-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x")}>
            {TRUST.map((item) => (
              <div key={item.title} className="flex gap-3 py-5 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="feed-heading" className={cn(SHELL, "py-16 lg:py-24")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={EYEBROW}>Sample channel</p>
              <h2 id="feed-heading" className={cn(H2, "mt-2")}>
                One study becomes a feed like this.
              </h2>
              <p className={LEAD}>
                These five scenes came out of ten interviews, a survey export and a diary study. Each runs about fifteen
                seconds and carries its quote and its source.
              </p>
            </div>
            <Link
              to="/demo"
              onClick={() => track("demo_open", { location: "feed_heading" })}
              className="cursor-pointer text-[0.9375rem] font-semibold whitespace-nowrap underline underline-offset-4"
            >
              Scroll the whole sample feed
            </Link>
          </div>
          <div className="mt-10">
            <SampleFeed />
          </div>
        </section>

        <section aria-labelledby="problem-heading" className="border-y border-border bg-card">
          <div className={cn(SHELL, "grid gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24")}>
            <div>
              <p className={EYEBROW}>The usual ending</p>
              <h2 id="problem-heading" className={cn(H2, "mt-2")}>
                You did the interviews. Then the findings sat in a deck.
              </h2>
              <p className={LEAD}>
                The readout goes well, a few people nod, and a month later someone asks a question the study already
                answered. The research was fine. The format asked too much of busy people.
              </p>
            </div>
            <blockquote className="border-l-4 border-mark pl-6">
              <p className="quote-voice text-[1.75rem] leading-[1.2] sm:text-[2.25rem]">
                “It stopped feeling like <span className="hl">help</span> and started feeling like{" "}
                <span className="hl">homework</span>.”
              </p>
              <footer className="mt-4 max-w-[52ch] text-[0.9375rem] text-muted-foreground">
                A participant in the sample study, talking about meal kits. Your stakeholders would say the same about a
                forty-page report.
              </footer>
            </blockquote>
          </div>
        </section>

        <section aria-labelledby="how-heading" className={cn(SHELL, "py-16 lg:py-24")}>
          <p className={EYEBROW}>How it works</p>
          <h2 id="how-heading" className={cn(H2, "mt-2")}>
            From raw files to a feed in three steps.
          </h2>
          <ol className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t-2 border-primary pt-4">
                <span className="figures text-5xl text-primary">{i + 1}</span>
                <h3 className="mt-3 text-2xl font-bold tracking-tight leading-tight">{step.title}</h3>
                <p className="mt-2.5 leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3">
            <CtaLink location="how" variant={variant.slug}>
              Start free
            </CtaLink>
            <p className="text-[0.9375rem] text-muted-foreground">{FREE_NOTE}</p>
          </div>
        </section>

        <PrivacySection />

        <section aria-labelledby="after-heading" className={cn(SHELL, "grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24")}>
          <div>
            <p className={EYEBROW}>Insights</p>
            <h2 id="after-heading" className={cn(H2, "mt-2")}>
              Then you find out whether it landed.
            </h2>
            <p className={LEAD}>
              People answer each finding with “rings true”, “surprised me” or “push back”, and leave questions on the
              scene itself. Insights adds it up, so you know which finding to defend in the next meeting and which one
              is already accepted.
            </p>
            <p className="mt-4 max-w-[58ch] leading-relaxed text-muted-foreground">
              Need slides anyway? One click drafts a readout deck from the same findings, and it downloads as PowerPoint
              you can edit.
            </p>
          </div>
          <div className="overflow-hidden rounded-[1.5rem] bg-card shadow-sheet">
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {[
                ["19", "people reached"],
                ["86%", "watched to the end"],
                ["14", "open questions"],
              ].map(([value, label]) => (
                <div key={label} className="px-4 py-5">
                  <p className="figures text-4xl text-primary">{value}</p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-[0.9375rem]">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Scene</th>
                  <th className="px-2 py-2.5 text-right font-medium">Finished</th>
                  <th className="px-2 py-2.5 text-right font-medium">Rings true</th>
                  <th className="px-4 py-2.5 text-right font-medium">Push back</th>
                </tr>
              </thead>
              <tbody>
                {INSIGHT_ROWS.map(([scene, finished, rings, push]) => (
                  <tr key={scene} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{scene}</td>
                    <td className="px-2 py-3 text-right">{finished}</td>
                    <td className="px-2 py-3 text-right">{rings}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(push) >= 4 ? (
                        <span className="rounded-sm bg-mark px-1.5 py-0.5 font-semibold text-mark-foreground">{push}</span>
                      ) : (
                        push
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              Sample numbers from the demo study. The marked one is the finding to bring to the next meeting.
            </p>
          </div>
        </section>

        <section aria-labelledby="compare-heading" className="border-y border-border bg-card">
          <div className={cn(SHELL, "py-16 lg:py-24")}>
            <p className={EYEBROW}>Why a feed</p>
            <h2 id="compare-heading" className={cn(H2, "mt-2")}>
              A repository waits to be searched. A feed shows up.
            </h2>
            <p className={LEAD}>
              Most research repositories are built for the researcher doing analysis. repofeed is built for the moment
              after, when the work has to reach people who weren’t in the room.
            </p>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left">
                <thead>
                  <tr className="border-b-2 border-foreground text-sm">
                    <th className="w-[22%] py-3 pr-4">
                      <span className="sr-only">Topic</span>
                    </th>
                    <th className="w-[36%] py-3 pr-6 font-medium text-muted-foreground">A typical repository</th>
                    <th className="py-3 font-bold">repofeed</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.topic} className="border-b border-border align-top last:border-b-0">
                      <th scope="row" className="py-4 pr-4 font-semibold">
                        {row.topic}
                      </th>
                      <td className="py-4 pr-6 text-muted-foreground">
                        <span className="flex gap-2.5">
                          <Minus className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
                          {row.usual}
                        </span>
                      </td>
                      <td className="py-4 font-medium">
                        <span className="flex gap-2.5">
                          <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />
                          {row.ours}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <PricingSection variant={variant.slug} />
        <Faq />

        <section aria-labelledby="final-heading" className="dark bg-studio">
          <div className={cn(SHELL, "grid gap-10 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:py-28")}>
            <div>
              <p className={EYEBROW}>You're on air</p>
              <h2 id="final-heading" className="title-card mt-3 max-w-[14ch] text-[2.75rem] text-white sm:text-[4rem]">
                Put your last study in front of people this week.
              </h2>
            </div>
            <div>
              <p className="max-w-md text-lg leading-relaxed text-white/65">
                Upload the files you already have and share the feed with as many viewers as you like.
              </p>
              <div ref={finalCtaRef} className="mt-6">
                <HeroSignup variant={variant.slug} id="final-email" location="final" />
                <p className="mt-3 text-[0.9375rem] text-white/55">{FREE_NOTE}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <StickyCta variant={variant.slug} hideWhen={hideWhen} />
    </div>
  );
}
