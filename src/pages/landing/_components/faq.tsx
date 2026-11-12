import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site.ts";

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "Does the AI make things up?",
    a: "It can draft, but it can’t invent evidence. Every quote is compared word for word with the file it came from, and every number is checked against your data. Anything that doesn’t match gets flagged for you in review, and nothing is shared until you publish it.",
  },
  {
    q: "What happens to my research files?",
    a: "Your browser opens the file on your own computer and sends only the text inside it. The original PDF, Word document, deck or spreadsheet is never uploaded. Video clips are the one exception: if you choose to add footage to a scene, that clip is stored so your workspace can play it.",
  },
  {
    q: "Is our research used to train AI models?",
    a: "No. We don’t use your research to train models of our own, and we don’t sell your data. The AI providers that draft scenes may use your text only to provide that service to us.",
  },
  {
    q: "Which files can I upload?",
    a: "PDF, Word, PowerPoint, Excel, CSV, plain text, Markdown, and transcript files such as VTT and SRT. You can also paste text straight in.",
  },
  {
    q: "Do the people watching need an account?",
    a: "No. Send them a private link and they can start watching. If they want to react or comment, they type their name once. Viewers are free on every plan.",
  },
  {
    q: "Can I change what the AI wrote?",
    a: "Yes. You review every scene before it’s published. Reword it, swap the footage, turn a scene off, or regenerate it. The readout deck downloads as a normal PowerPoint file, so every slide is editable.",
  },
  {
    q: "What does the free plan include?",
    a: "Three active studies, one editor, unlimited viewers, share links and Insights. No card is needed. Paid plans start with a 14-day trial.",
  },
];

export default function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
      <div>
        <h2 id="faq-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">Questions people ask before they try it</h2>
        <p className="mt-4 text-muted-foreground">
          Something else on your mind? Write to{" "}
          <a href={SUPPORT_MAILTO} className="cursor-pointer font-medium text-foreground underline underline-offset-4">{SUPPORT_EMAIL}</a>{" "}
          or read the <Link to="/help" className="cursor-pointer font-medium text-foreground underline underline-offset-4">Help Center</Link>.
        </p>
      </div>
      <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-5">
        {QUESTIONS.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="cursor-pointer py-4 text-left text-base font-semibold">{item.q}</AccordionTrigger>
            <AccordionContent className="max-w-prose pb-5 text-[0.9375rem] leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
