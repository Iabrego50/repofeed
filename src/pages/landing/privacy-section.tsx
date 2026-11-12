import { FileText, Laptop, ShieldCheck } from "lucide-react";

const FLOW = [
  { icon: Laptop, label: "interviews.docx", sub: "Opened by your browser. Stays on your computer." },
  { icon: FileText, label: "The text inside", sub: "The only thing that gets sent." },
  { icon: ShieldCheck, label: "Cited scenes", sub: "Quotes and numbers checked against that text." },
];

const FACTS = [
  { title: "Originals are never uploaded", body: "PDFs, Word documents, decks and spreadsheets are read on your own machine. There’s no copy of the file on our side to track down or delete." },
  { title: "Quotes are checked word for word", body: "If a quote or a number doesn’t match what’s in your file, the scene is flagged before you publish it." },
  { title: "Not used for training", body: "We don’t train models of our own on your research, and we don’t sell your data." },
];

/** The two objections that stop a research team from trying an AI tool: where do my files go, and can I trust what it writes. */
export default function PrivacySection() {
  return (
    <section aria-labelledby="privacy-heading" className="dark">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <h2 id="privacy-heading" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Your research files never leave your computer
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Participant interviews, internal decks, anything under NDA. Your browser reads each file locally and sends only the words needed to build the scenes.
            </p>
          </div>
          <ol className="space-y-2">
            {FLOW.map((step, i) => (
              <li key={step.label} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-foreground">
                  <step.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.sub}</p>
                </div>
                <span className="ml-auto text-sm text-muted-foreground">{i + 1}</span>
              </li>
            ))}
          </ol>
        </div>
        <ul className="mt-12 grid gap-8 border-t border-border pt-8 md:grid-cols-3">
          {FACTS.map((fact) => (
            <li key={fact.title}>
              <p className="font-semibold">{fact.title}</p>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{fact.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted-foreground">
          One exception, so there are no surprises: if an editor adds a video clip as scene footage, that clip is stored so the workspace can play it.
        </p>
      </div>
    </section>
  );
}
