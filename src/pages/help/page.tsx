import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleHelp, Mail, Search, SearchX } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import PageHeader from "@/components/page-header.tsx";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site.ts";
import { ARTICLES, CATEGORIES, articleText } from "./_lib/articles.ts";
import ArticleBody from "./_components/article-body.tsx";

export default function HelpPage() {
  const [params, setParams] = useSearchParams();
  const open = params.get("article") ?? "";
  const [query, setQuery] = useState("");

  const index = useMemo(() => ARTICLES.map((a) => ({ article: a, text: articleText(a) })), []);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length ? index.filter((i) => terms.every((t) => i.text.includes(t))).map((i) => i.article) : ARTICLES;

  const setOpen = (id: string) => setParams(id ? { article: id } : {}, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:py-12">
      <PageHeader
        eyebrow="Help Center"
        title="How can we help?"
        description="Short guides to building studies, sharing them and reading the results."
        actions={
          <Button asChild variant="secondary" className="h-11">
            <a href={SUPPORT_MAILTO}><Mail className="size-4" /> Email support</a>
          </Button>
        }
      />
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help, for example: flagged, footage, share link"
          aria-label="Search help articles"
          className="h-12 pl-11"
        />
      </div>

      {matches.length === 0 ? (
        <Empty className="mt-8 rounded-2xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
            <EmptyTitle>No articles match</EmptyTitle>
            <EmptyDescription>Try a different word, or email {SUPPORT_EMAIL} and we'll help directly.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Accordion type="single" collapsible value={open} onValueChange={setOpen} className="mt-8 space-y-8">
          {CATEGORIES.map((cat) => {
            const list = matches.filter((a) => a.category === cat);
            if (!list.length) return null;
            return (
              <section key={cat} aria-label={cat}>
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">{cat}</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
                  {list.map((a) => (
                    <AccordionItem key={a.id} value={a.id} id={`help-${a.id}`} className="border-border px-4 sm:px-5">
                      <AccordionTrigger className="cursor-pointer py-4 hover:no-underline">
                        <span className="flex min-w-0 items-start gap-3 text-left">
                          <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block font-display text-base font-bold">{a.title}</span>
                            <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{a.summary}</span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-7">
                        <ArticleBody article={a} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </div>
              </section>
            );
          })}
        </Accordion>
      )}

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Didn't find what you need?{" "}
        <a href={SUPPORT_MAILTO} className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">Email {SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}
