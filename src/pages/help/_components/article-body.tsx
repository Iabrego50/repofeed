import { Lightbulb } from "lucide-react";
import type { HelpArticle } from "../_lib/articles.ts";

/** Renders an article's paragraphs, numbered steps, bullets and tip. */
export default function ArticleBody({ article }: { article: HelpArticle }) {
  return (
    <div className="space-y-4 pb-2 text-sm leading-relaxed text-muted-foreground">
      {article.paragraphs?.map((p) => <p key={p}>{p}</p>)}
      {article.steps && (
        <ol className="space-y-3">
          {article.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {article.bullets && (
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          {article.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
      {article.tip && (
        <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" /> {article.tip}
        </p>
      )}
    </div>
  );
}
