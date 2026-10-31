import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import Logo from "@/components/logo.tsx";
import ReelCanvas from "@/components/reel/reel-canvas.tsx";
import type { ReelData } from "@/lib/reel/painter.ts";
import { ArrowRight, CheckCircle2, Clapperboard, FileText, Link2, Lock, MessageSquareText, PencilLine, Play, Presentation, Quote, Sparkles } from "lucide-react";
import PricingSection from "./pricing-section.tsx";
import PrivacySection from "./privacy-section.tsx";
import SiteFooter from "@/components/site-footer.tsx";

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

const POINTS = [
  { icon: Lock, title: "Files stay with you", body: "Research files are read in your browser and never uploaded. Only the text inside is used." },
  { icon: Quote, title: "Every scene is cited", body: "Quotes are checked word-for-word and numbers against your files before anything ships." },
  { icon: MessageSquareText, title: "Stakeholders talk back", body: "Rings true, surprised me, push back. Questions and action items, threaded on each scene." },
  { icon: CheckCircle2, title: "Proof it was watched", body: "See who you reached, what they finished and where the pushback is." },
];

const STEPS = [
  { icon: FileText, title: "Drop in your research", body: "Interviews, surveys, diary notes. We read every file and pull out the findings that matter." },
  { icon: Sparkles, title: "Scenes write themselves", body: "One point per scene, 10 to 20 seconds long: a hook, the quote, the number, the takeaway." },
  { icon: Clapperboard, title: "Your footage or stock", body: "Set scenes over your own clips, pick from the stock library, or let AI paint a backdrop that fits." },
];

const BEFORE_AFTER = [
  { before: "A 40-page report nobody opens", after: "Scenes your team scrolls on their own" },
  { before: "Findings shared once, then forgotten", after: "Insights that keep showing up in the feed" },
  { before: "Silence after the readout", after: "Reactions, questions and action items on every scene" },
  { before: "No idea who actually read it", after: "See who watched, what they finished and where they pushed back" },
];

const NO_LIST = ["No tagging.", "No taxonomy.", "No training.", "No accounts for viewers."];

const VIEWER_FLOW = ["Get the private link", "Tap it", "Scroll the feed"];

const EASY = [
  { title: "Upload, done", body: "Drop in raw files. We find the findings, write the scenes and check every quote. Nothing to code or tag by hand." },
  { title: "Organized by study", body: "Every project lives in its own study, so your whole research history stays in one place." },
  { title: "Nothing to learn", body: "If your team can scroll a phone, they can use it. Viewers open a private link and start watching." },
];

const DECK_POINTS = [
  { icon: Sparkles, title: "Written from your findings", body: "Headlines, key numbers, real quotes and recommendations, all pulled from your study and checked against your files." },
  { icon: PencilLine, title: "Fully editable", body: "Download as PowerPoint. Every headline, chart and quote is real, editable text, so you can reword, restyle or add your own slides." },
  { icon: Presentation, title: "Ready to present", body: "Present full screen in one click, or make a fresh version whenever new research comes in." },
];

const DECK_BARS = [72, 48, 88, 36];

/** Static mock of a readout slide with an "editing" cursor, so visitors see what they get. */
function DeckPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease }}
      className="relative"
    >
      <div className="absolute -bottom-4 -right-3 left-6 top-6 rounded-2xl border border-border bg-card/60" aria-hidden />
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_30px_90px_-30px_rgba(47,155,255,0.45)] sm:p-7">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-xs">Key finding</p>
        <p className="-mx-1.5 mt-2 w-fit max-w-[85%] rounded-md px-1.5 py-0.5 font-display text-lg font-extrabold leading-tight ring-2 ring-primary sm:text-2xl">
          7 of 10 cancel when it feels like homework
          <motion.span
            aria-hidden
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="ml-1 inline-block h-5 w-0.5 translate-y-1 bg-primary sm:h-6"
          />
        </p>
        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-4 sm:mt-6">
          <div className="flex h-20 items-end gap-2 sm:h-28">
            {DECK_BARS.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.08, ease }}
                className={i === 2 ? "flex-1 rounded-t-md bg-primary" : "flex-1 rounded-t-md bg-primary/30"}
              />
            ))}
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3">
            <Quote className="size-4 text-primary" />
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{"\u201C"}It started feeling like homework.{"\u201D"}</p>
          </div>
        </div>
      </div>
      <span className="absolute -top-3 right-4 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
        <PencilLine className="size-3" /> Editable .pptx
      </span>
    </motion.div>
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(circle,rgba(47,155,255,0.22),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-60 -left-40 size-[720px] rounded-full bg-[radial-gradient(circle,rgba(54,212,255,0.10),transparent_65%)]"
      />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/demo" className="hidden min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex">
            Demo
          </Link>
          <a href="#pricing" className="hidden min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex">
            Pricing
          </a>
          <Link to="/help" className="hidden min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex">
            Help
          </Link>
          <SignInButton variant="secondary" signInText="Sign in" />
        </div>
      </header>
      <main className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
        {/* Hero copy renders fully visible on first paint; only the phone preview animates in. */}
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Research, as a feed
          </p>
          <h1 className="mt-4 text-balance font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Nobody reads the report. <span className="text-primary">Everyone</span> watches the scene.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            repofeed.ai turns interviews, surveys and diary notes into short, cited insight scenes, made for you and set over your own footage or stock. Your team scrolls them like a social feed, reacts, asks questions and logs actions.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignInButton size="lg" className="h-12 px-6 text-base font-semibold" signInText="Get started free" />
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base font-semibold">
              <Link to="/demo">
                <Play className="size-4" /> Watch the demo feed
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">No sign-up needed to watch. Your research files never leave your computer.</p>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2">
            {POINTS.map((p) => (
              <li key={p.title} className="border-t border-border pt-4">
                <p.icon className="size-5 text-primary" />
                <p className="mt-3 font-display text-base font-bold">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease }}
          className="mx-auto w-full max-w-[340px]"
        >
          <Link
            to="/demo"
            aria-label="Open the full demo feed"
            className="group relative block cursor-pointer rounded-[28px] border border-border bg-card p-2 shadow-[0_40px_120px_-30px_rgba(47,155,255,0.45)] transition-transform hover:-translate-y-1"
          >
            <ReelCanvas reel={PREVIEW} playing className="aspect-[9/16] w-full rounded-[22px]" />
            <span className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Play className="size-4" /> Scroll the full feed
            </span>
          </Link>
        </motion.div>
      </main>
      <PrivacySection />
      <section aria-labelledby="engaged-heading" className="relative mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Finally</p>
            <h2 id="engaged-heading" className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Research that actually gets <span className="text-primary">engaged with</span>.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              You spent weeks on the interviews. Now the findings reach the people who need them, in the format they already scroll every day. Stakeholders watch, react and talk back, and you can see it happen.
            </p>
          </div>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {BEFORE_AFTER.map((row, i) => (
              <motion.li
                key={row.before}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.08, ease }}
                className="grid gap-1 border-b border-border p-5 last:border-b-0 sm:grid-cols-2 sm:gap-6"
              >
                <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">{row.before}</p>
                <p className="flex items-start gap-2 text-sm font-medium">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  {row.after}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>
      <section aria-labelledby="easy-heading" className="relative mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(47,155,255,0.18),transparent_65%)]"
          />
          <p className="relative font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Research repository</p>
          <h2 id="easy-heading" className="relative mt-3 max-w-3xl text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            The easiest research repository you'll ever use.
          </h2>
          <ul className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {NO_LIST.map((t, i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.07, ease }}
                className="font-display text-xl font-bold text-muted-foreground sm:text-2xl"
              >
                {t}
              </motion.li>
            ))}
          </ul>
          <p className="relative mt-6 max-w-2xl text-muted-foreground">
            Most repositories need a librarian: tags to maintain, a taxonomy to agree on, training sessions for every new hire. repofeed.ai skips all of that. Your research goes in, and it comes out organized into scenes people want to watch.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease }}
            className="relative mt-8 grid gap-5 rounded-2xl border border-primary/40 bg-primary/10 p-5 sm:p-6 md:grid-cols-[auto_1fr] md:items-center"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Link2 className="size-6" />
            </span>
            <div>
              <p className="font-display text-xl font-bold sm:text-2xl">Viewers need no account. Just a private link.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Send stakeholders a private share link. They tap it and start scrolling the feed right away, with no sign-up, no password and no app to install. If they want to react or comment, they just add their name.
              </p>
            </div>
            <ol className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider md:col-span-2">
              {VIEWER_FLOW.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-full bg-background/60 px-3 py-1.5">{step}</span>
                  {i < VIEWER_FLOW.length - 1 && <ArrowRight className="size-3.5 text-primary" />}
                </li>
              ))}
            </ol>
          </motion.div>
          <div className="relative mt-10 grid gap-6 border-t border-border pt-8 md:grid-cols-3">
            {EASY.map((e) => (
              <div key={e.title}>
                <p className="font-display text-lg font-bold">{e.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section aria-labelledby="how-heading" className="relative mx-auto max-w-6xl px-5 py-16">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">How scenes are made</p>
        <h2 id="how-heading" className="mt-3 max-w-2xl text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          You bring the research. We make the scenes.
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          No editing timeline, no video skills. Every scene is generated for you, then you review, tweak or swap the footage before anyone sees it.
        </p>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08, ease }}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-6"
            >
              <span aria-hidden className="absolute right-5 top-4 font-display text-6xl font-extrabold text-foreground/5">
                {i + 1}
              </span>
              <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <s.icon className="size-5" />
              </span>
              <p className="mt-5 font-display text-lg font-bold">{s.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="deck-heading" className="relative mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Readout decks</p>
            <h2 id="deck-heading" className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              The readout deck <span className="text-primary">builds itself</span>.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              One click turns your study's findings into a polished slide deck: the outcomes, the evidence and what to do next. Present it right in the browser, or download it as PowerPoint and make it yours.
            </p>
            <ul className="mt-8 space-y-4">
              {DECK_POINTS.map((d) => (
                <li key={d.title} className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <d.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-display text-base font-bold">{d.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{d.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <DeckPreview />
        </div>
      </section>
      <PricingSection />
      <SiteFooter />
    </div>
  );
}
