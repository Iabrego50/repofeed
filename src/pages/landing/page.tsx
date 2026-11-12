import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, FileSearch, Heart, MessageCircle, Play, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Logo from "@/components/logo.tsx";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";
import { track } from "@/lib/analytics";
import { CtaLink, HeroSignup } from "./_components/cta.tsx";
import Faq from "./_components/faq.tsx";
import PricingSection from "./pricing-section.tsx";
import PrivacySection from "./privacy-section.tsx";
import { variantFor } from "./variants.ts";

const PREVIEW: ReelData = {
  title: "Help that became homework",
  track: "What customers say",
  trackIndex: 0,
  studyTitle: "Supperly Meal-Kit Cancellation Study",
  scenes: [
    { type: "hook", text: "When does a meal kit stop *helping*?" },
    { type: "quote", text: "It stopped feeling like help and started feeling like homework.", by: "Parent of two, 7 months" },
    { type: "stat", num: "7 of 10", label: "said it started to feel like an obligation" },
    { type: "cta", text: "Obligation is the *churn signal*.", sub: "Source: supperly-cancel-interviews.txt" },
  ],
  footage: { url: "/footage/mother-cooking.mp4", caption: "Home visit · P07 · Day 3" },
};

const STEPS = [
  {
    title: "Drop in what you already have",
    body: "Interview transcripts, survey exports, diary notes, the deck from last quarter. PDF, Word, PowerPoint, Excel, CSV and plain text all work.",
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
  { topic: "Getting research in", usual: "Import it, then tag and code it by hand", ours: "Upload the files. Scenes are drafted for you to review." },
  { topic: "Who can use it", usual: "Researchers. Everyone else needs a seat and a walkthrough.", ours: "Anyone with the link. Watching needs no account." },
  { topic: "How findings travel", usual: "Someone has to remember to go and search", ours: "New scenes land in the feed, unwatched ones first" },
  { topic: "Proof behind a claim", usual: "A tag that links to a highlight", ours: "The quote, checked word for word, one tap from the scene" },
  { topic: "Knowing it landed", usual: "Page views, if anything", ours: "Who watched, who finished, and where they pushed back" },
  { topic: "What you pay for", usual: "Often a seat for every reader, or a sales call", ours: "Editors only. Viewers are free." },
];

function Nav({ variant }: { variant: string }) {
  const { user } = useAuth();
  const link = "hidden min-h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex";
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-2.5">
        <Link to="/" aria-label="repofeed.ai home" className="cursor-pointer">
          <Logo />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1">
          <Link to="/demo" className={link}>Demo</Link>
          <a href="#pricing" className={link}>Pricing</a>
          <Link to="/help" className={link}>Help</Link>
          {user ? (
            <CtaLink location="nav" variant={variant} to="/feed" className="h-9 px-4 text-sm">Go to the feed</CtaLink>
          ) : (
            <>
              <Link to="/signin" className="flex min-h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <CtaLink location="nav" variant={variant} className="h-9 px-4 text-sm">Start free</CtaLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/** The product, running: a real scene in a phone, with the conversation it starts beside it. */
function HeroDevice() {
  return (
    <div className="relative mx-auto w-full max-w-[320px] lg:mr-6">
      <Link
        to="/demo"
        onClick={() => track("demo_open", { location: "hero_device" })}
        aria-label="Open the full demo feed"
        className="dark group relative block cursor-pointer overflow-hidden rounded-[2rem] border-[6px] border-[#10151f] shadow-lift"
      >
        <ReelCanvas reel={PREVIEW} playing className="aspect-[9/16] w-full" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent p-4 pt-16 text-white">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-black">
            <Play className="size-3.5 fill-current" /> Watch the demo feed
          </span>
          <span className="flex flex-col items-center gap-3 pb-1 text-[11px] font-medium">
            <span className="flex flex-col items-center gap-0.5"><Heart className="size-5" />24</span>
            <span className="flex flex-col items-center gap-0.5"><MessageCircle className="size-5" />6</span>
            <FileSearch className="size-5" />
          </span>
        </span>
      </Link>
      <figure className="absolute -left-32 top-[52%] hidden w-60 rounded-xl border border-border bg-card p-4 shadow-lift lg:block">
        <figcaption className="flex items-center gap-2 text-sm">
          <span className="grid size-7 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JH</span>
          <span className="font-medium">Jon, Product</span>
          <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Question</span>
        </figcaption>
        <p className="mt-2 text-sm text-muted-foreground">Was this only people who cancelled after the intro rate, or everyone?</p>
      </figure>
    </div>
  );
}

export default function Landing() {
  const { slug } = useParams();
  const variant = variantFor(slug);

  useEffect(() => {
    track("landing_view", { variant: variant.slug || "home" });
  }, [variant.slug]);

  return (
    <div className="min-h-dvh bg-background">
      <Nav variant={variant.slug} />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-16">
          <div>
            <h1 className="max-w-[18ch] text-balance text-[2.5rem] font-bold leading-[1.04] tracking-[-0.035em] sm:text-6xl">
              {variant.headline}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{variant.sub}</p>
            <div className="mt-8">
              <HeroSignup variant={variant.slug} />
              <p className="mt-3 text-sm text-muted-foreground">
                Free for your first three studies. No card, no password.{" "}
                <Link to="/demo" onClick={() => track("demo_open", { location: "hero_text" })} className="cursor-pointer font-medium text-foreground underline underline-offset-4">
                  Watch the demo first
                </Link>
              </p>
            </div>
            <ul className="mt-10 grid max-w-xl gap-x-8 gap-y-3 text-[0.9375rem] sm:grid-cols-2">
              {[
                "Your files never leave your computer",
                "Every quote checked against the source",
                "Viewers need no account",
                "See who watched and who pushed back",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <HeroDevice />
        </section>

        <section aria-labelledby="problem-heading" className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <h2 id="problem-heading" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                You did the interviews. Then the findings sat in a deck.
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                The readout goes well, a few people nod, and a month later someone asks a question the study already answered. The research was fine. The format asked too much of busy people.
              </p>
            </div>
            <blockquote className="border-l-4 border-mark pl-6">
              <p className="quote-voice text-2xl leading-snug sm:text-[1.75rem]">
                “It stopped feeling like <span className="hl">help</span> and started feeling like <span className="hl">homework</span>.”
              </p>
              <footer className="mt-4 text-sm text-muted-foreground">
                A participant in the demo study, talking about meal kits. Your stakeholders would say the same about a forty-page report.
              </footer>
            </blockquote>
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2 id="how-heading" className="max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            From raw files to a feed in three steps
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t-2 border-foreground pt-5">
                <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
                <h3 className="mt-1 text-xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <PrivacySection />

        <section aria-labelledby="after-heading" className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <h2 id="after-heading" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Then you find out whether it landed
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              People react with “rings true”, “surprised me” or “push back”, and leave questions and action items on the scene itself. Insights adds it up, so you know which finding to defend in the next meeting and which one is already accepted.
            </p>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Need slides anyway? One click drafts a readout deck from the same findings. Present it in the browser or download it as PowerPoint and make it yours.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <CtaLink location="insights" variant={variant.slug} to="/demo/insights" secondary>See a sample Insights page</CtaLink>
              <CtaLink location="explore" variant={variant.slug} to="/demo/explore" secondary>Search the sample study</CtaLink>
              <CtaLink location="deck" variant={variant.slug} to="/demo/deck" secondary>Generate a sample deck</CtaLink>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lift">
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
              {[
                ["19", "people reached"],
                ["86%", "watched to the end"],
                ["14", "open questions"],
              ].map(([value, label]) => (
                <div key={label} className="px-3 py-4">
                  <p className="text-2xl font-bold tracking-tight">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Scene</th>
                  <th className="px-2 py-2 text-right font-medium">Finished</th>
                  <th className="px-2 py-2 text-right font-medium">Rings true</th>
                  <th className="px-4 py-2 text-right font-medium">Push back</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Why people really leave", "89%", 9, 2],
                  ["The hidden cancel button", "100%", 10, 1],
                  ["Fewer nights, please", "71%", 3, 5],
                  ["Pause would have saved them", "93%", 7, 0],
                ].map(([scene, finished, rings, push]) => (
                  <tr key={scene} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{scene}</td>
                    <td className="px-2 py-2.5 text-right">{finished}</td>
                    <td className="px-2 py-2.5 text-right">{rings}</td>
                    <td className={Number(push) >= 4 ? "px-4 py-2.5 text-right font-semibold text-destructive" : "px-4 py-2.5 text-right"}>{push}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground">Sample numbers from the demo study.</p>
          </div>
        </section>

        <section aria-labelledby="compare-heading" className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <h2 id="compare-heading" className="max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              A repository waits to be searched. A feed shows up.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Most research repositories are built for the researcher doing analysis. repofeed is built for the moment after, when the work has to reach people who weren’t in the room.
            </p>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-border text-sm">
                    <th className="w-[22%] py-3 pr-4 font-medium text-muted-foreground"><span className="sr-only">Topic</span></th>
                    <th className="w-[36%] py-3 pr-6 font-medium text-muted-foreground">A typical repository</th>
                    <th className="py-3 font-semibold">repofeed</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.topic} className="border-b border-border align-top last:border-b-0">
                      <th scope="row" className="py-3.5 pr-4 font-semibold">{row.topic}</th>
                      <td className="py-3.5 pr-6 text-muted-foreground">
                        <span className="flex gap-2"><X className="mt-1 size-4 shrink-0 text-muted-foreground/60" />{row.usual}</span>
                      </td>
                      <td className="py-3.5">
                        <span className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />{row.ours}</span>
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

        <section aria-labelledby="final-heading" className="dark">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-20">
            <div>
              <h2 id="final-heading" className="max-w-xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Put your last study in front of people this week.
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Upload the files you already have. Your first three studies are free, and you can share them with as many viewers as you like.
              </p>
            </div>
            <div className="w-full max-w-md shrink-0">
              <HeroSignup variant={variant.slug} id="final-email" location="final" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
