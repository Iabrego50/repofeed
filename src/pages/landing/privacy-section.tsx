import { motion } from "motion/react";
import { ArrowRight, FileText, Laptop, Lock, ShieldCheck, Trash2 } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const FACTS = [
  { icon: Laptop, title: "Read on your computer", body: "PDFs, Word docs, slides and spreadsheets are opened right in your browser. The original file is never uploaded." },
  { icon: FileText, title: "Only the text moves", body: "We use just the words inside your files to find the insights. Images, layouts and the files themselves stay with you." },
  { icon: Trash2, title: "Nothing to clean up", body: "There's no copy of your originals to track down or delete, because we never had one." },
];

const FLOW = [
  { label: "interviews.docx", sub: "Stays on your computer", icon: Laptop },
  { label: "Text only", sub: "Read in your browser", icon: FileText },
  { label: "Insight scenes", sub: "Cited and checked", icon: ShieldCheck },
];

/** Homepage section that explains research files never leave the client's device. */
export default function PrivacySection() {
  return (
    <section aria-labelledby="privacy-heading" className="relative mx-auto max-w-6xl px-5 py-16">
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-[linear-gradient(135deg,rgba(47,155,255,0.16),rgba(14,20,34,0.9)_55%)] p-6 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(238,243,251,0.03)_0,rgba(238,243,251,0.03)_1px,transparent_1px,transparent_48px)]"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Lock className="size-3.5" /> Private by design
            </p>
            <h2 id="privacy-heading" className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Your research files <span className="text-primary">never leave your computer</span>.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Proprietary interviews, confidential decks, files full of internal details. The original files never get uploaded. Your browser reads each one and sends only the text needed to build your scenes.
            </p>
          </div>
          <ol className="space-y-3">
            {FLOW.map((step, i) => (
              <motion.li
                key={step.label}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.1, ease }}
                className="flex flex-col items-start gap-3"
              >
                <div className="flex w-full items-center gap-4 rounded-2xl border border-border bg-background/70 p-4 backdrop-blur">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.sub}</p>
                  </div>
                </div>
                {i < FLOW.length - 1 && <ArrowRight aria-hidden className="ml-7 size-4 rotate-90 text-primary" />}
              </motion.li>
            ))}
          </ol>
        </div>
        <ul className="relative mt-10 grid gap-6 border-t border-border pt-8 md:grid-cols-3">
          {FACTS.map((f) => (
            <li key={f.title}>
              <f.icon className="size-5 text-primary" />
              <p className="mt-3 font-display text-lg font-bold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
        <p className="relative mt-8 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">About video clips:</span> research documents stay on your computer. If an editor chooses to add a video clip as scene footage, that clip is stored securely so everyone in your workspace can watch it.
        </p>
      </div>
    </section>
  );
}
