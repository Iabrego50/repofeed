import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Play, Search, Sparkles, Tag, X } from "lucide-react";
import { api } from "@/lib/api/complete";
import { askResearch, tagTopics, type AskResponse } from "@/lib/api/explore.ts";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { cn } from "@/lib/utils.ts";
import type { FeedReel } from "@/lib/api/mappers.ts";
import {
  citationParts,
  rankInsights,
  topicCounts,
  topicLabel,
  withTopics,
  type LibraryInsight,
} from "@/lib/research-search.ts";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type Insight = LibraryInsight & { reel: FeedReel };

const SUGGESTED = ["What frustrates people most?", "What should we fix first?", "What do people say about price?"];
const TOPICS_SHOWN = 14;

function toInsight(reel: FeedReel): Insight {
  return {
    id: reel._id,
    title: reel.title,
    track: reel.track,
    studyTitle: reel.studyTitle ?? "",
    topics: reel.topics ?? [],
    scenes: reel.scenes ?? [],
    reel,
  };
}

function firstOf<T extends { type: string }>(scenes: T[], type: string): T | undefined {
  return scenes.find((s) => s.type === type);
}

function TopicChip({ topic, active, count, onClick }: { topic: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground",
      )}
    >
      {topicLabel(topic)}
      {count != null && <span className={cn("text-xs", active ? "text-background/70" : "text-muted-foreground")}>{count}</span>}
      {active && <X className="size-3.5" aria-hidden />}
    </button>
  );
}

function InsightCard({
  insight,
  cite,
  why,
  snippet,
  activeTopics,
  onTopic,
}: {
  insight: Insight;
  cite?: number;
  why?: string | null;
  snippet?: string | null;
  activeTopics: string[];
  onTopic: (topic: string) => void;
}) {
  const quote = firstOf(insight.scenes, "quote") as { text?: string; by?: string } | undefined;
  const stat = firstOf(insight.scenes, "stat") as { num?: string; label?: string } | undefined;
  const takeaway = (firstOf(insight.scenes, "cta") as { text?: string } | undefined)?.text?.replace(/\*/g, "");
  return (
    <article id={cite ? `cite-${cite}` : undefined} className="scroll-mt-24 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {cite != null && (
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-mark text-xs font-bold text-mark-foreground" aria-label={`Source ${cite}`}>
            {cite}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold tracking-tight">
            <Link to={`/?reel=${insight.id}`} className="cursor-pointer hover:underline hover:underline-offset-4">
              {insight.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {insight.studyTitle}
            {insight.track ? `, ${insight.track}` : ""}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-9 shrink-0">
          <Link to={`/?reel=${insight.id}`}>
            <Play className="size-3.5" /> Watch
          </Link>
        </Button>
      </div>

      {why && <p className="mt-3 text-[0.9375rem]">{why}</p>}

      {snippet && !why ? (
        <p className="mt-3 text-[0.9375rem] text-muted-foreground">{snippet}</p>
      ) : quote?.text ? (
        <blockquote className="mt-3 border-l-2 border-mark pl-3">
          <p className="quote-voice text-[1.0625rem] leading-snug">“{quote.text}”</p>
          {quote.by && <footer className="mt-1 text-xs text-muted-foreground">{quote.by}</footer>}
        </blockquote>
      ) : takeaway ? (
        <p className="mt-3 text-[0.9375rem] text-muted-foreground">{takeaway}</p>
      ) : null}

      {stat?.num && (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight">{stat.num}</span>
          <span className="text-sm text-muted-foreground">{stat.label}</span>
        </p>
      )}

      {insight.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {insight.topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => onTopic(topic)}
              aria-pressed={activeTopics.includes(topic)}
              className={cn(
                "inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring",
                activeTopics.includes(topic) ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              <Tag className="size-3" aria-hidden /> {topicLabel(topic)}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function AnswerPanel({ result, question, loading, topics }: { result: AskResponse | undefined; question: string; loading: boolean; topics: string[] }) {
  if (loading) {
    return (
      <section aria-live="polite" className="rounded-xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading your insights to answer “{question}”{topics.length ? ` within ${topics.map(topicLabel).join(" and ")}` : ""}
        </p>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    );
  }
  if (!result) return null;

  if (result.mode === "keyword") {
    return (
      <section aria-live="polite" className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">{result.insights.length ? "Closest matches" : "Nothing matches yet"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.notice === "ai_unavailable"
            ? "A written answer isn’t available right now, so these are the insights that share the most words with your question."
            : result.insights.length
              ? "These insights share the most words with your question. Written answers aren’t switched on for this workspace."
              : "None of your insights mention this. Try other words, or pick a topic."}
        </p>
      </section>
    );
  }

  return (
    <section aria-live="polite" aria-labelledby="answer-heading" className="rounded-xl border border-border bg-card p-5">
      <h2 id="answer-heading" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Sparkles className="size-4" /> Answer from your research
      </h2>
      {result.answer ? (
        <p className="mt-2 text-[1.0625rem] leading-relaxed">
          {citationParts(result.answer).map((part, i) =>
            "cite" in part ? (
              <a
                key={i}
                href={`#cite-${part.cite}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`cite-${part.cite}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="mx-0.5 inline-grid size-5 cursor-pointer place-items-center rounded-full bg-mark align-[0.15em] text-[11px] font-bold text-mark-foreground no-underline hover:ring-2 hover:ring-foreground"
                aria-label={`Source ${part.cite}`}
              >
                {part.cite}
              </a>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      ) : (
        <p className="mt-2 text-[0.9375rem]">Your research doesn’t cover this yet.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Written by AI from {result.searched} {result.searched === 1 ? "insight" : "insights"}{topics.length ? ` about ${topics.map(topicLabel).join(" and ")}` : ""}, using only the ones cited. Open a source to check it.
      </p>
    </section>
  );
}

/**
 * Explore: browse every insight by topic, filter by keyword as you type, or ask
 * a question and get a short answer that cites the insights it came from.
 */
export default function ExplorePage() {
  const { current } = useWorkspace();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const asked = params.get("q") ?? "";
  const askNow = params.get("ask") === "1";
  const activeTopics = params.getAll("topic");
  const [draft, setDraft] = useState(asked);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const deferred = useDeferredValue(draft);
  const inputRef = useRef<HTMLInputElement>(null);

  // A new question from elsewhere (the search palette, a link) replaces what's typed.
  const [syncedFrom, setSyncedFrom] = useState(asked);
  if (asked !== syncedFrom) {
    setSyncedFrom(asked);
    setDraft(asked);
  }

  const libraryKey = ["feed", "library", current?._id];
  const { data: reels, isLoading } = useQuery({
    queryKey: libraryKey,
    queryFn: () => api.feed.list({ workspaceId: current!._id, limit: 2000 }),
    enabled: !!current,
    staleTime: 60_000,
  });
  const insights = useMemo(() => (reels ?? []).map(toInsight), [reels]);
  const byId = useMemo(() => new Map(insights.map((i) => [i.id, i])), [insights]);
  const untagged = insights.filter((i) => i.topics.length === 0).length;

  // Insights made before topics existed are tagged in the background, a batch at a time.
  // Runs once per visit to the page; a ref (not state) guards it so re-renders can't cancel it.
  const [tagging, setTagging] = useState<"idle" | "running" | "done">("idle");
  const tagStarted = useRef(false);
  useEffect(() => {
    if (!current || isLoading || untagged === 0 || tagStarted.current) return;
    tagStarted.current = true;
    const workspaceId = current._id;
    setTagging("running");
    void (async () => {
      for (let round = 0; round < 10; round++) {
        try {
          const result = await tagTopics({ workspaceId });
          if (result.tagged > 0) await queryClient.invalidateQueries({ queryKey: ["feed", "library", workspaceId] });
          if (result.tagged === 0 || result.remaining === 0) break;
        } catch {
          break;
        }
      }
      setTagging("done");
    })();
  }, [current, isLoading, untagged, queryClient]);

  const askQuery = useQuery({
    queryKey: ["ask", current?._id, asked, activeTopics.join("|")],
    queryFn: () => askResearch({ workspaceId: current!._id, question: asked, topics: activeTopics }),
    enabled: !!current && askNow && asked.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const counts = useMemo(() => topicCounts(insights), [insights]);
  const pool = useMemo(() => withTopics(insights, activeTopics), [insights, activeTopics]);
  const typed = deferred.trim();
  const ranked = useMemo(() => (typed ? rankInsights(pool, typed, 60) : []), [pool, typed]);
  const showingAnswer = askNow && asked === draft && asked.trim().length >= 2;

  const update = (next: { q?: string | null; ask?: boolean; topics?: string[] }) => {
    const p = new URLSearchParams(params);
    if (next.q !== undefined) {
      if (next.q) p.set("q", next.q);
      else p.delete("q");
    }
    if (next.ask !== undefined) {
      if (next.ask) p.set("ask", "1");
      else p.delete("ask");
    }
    if (next.topics) {
      p.delete("topic");
      next.topics.forEach((t) => p.append("topic", t));
    }
    setParams(p, { replace: true });
  };

  const ask = (question: string) => {
    const q = question.trim();
    if (q.length < 2) return;
    setDraft(q);
    update({ q, ask: true });
    track("search", { kind: "ask", length: q.length, workspaceId: current?._id });
  };

  const toggleTopic = (topic: string) => {
    const next = activeTopics.includes(topic) ? activeTopics.filter((t) => t !== topic) : [...activeTopics, topic];
    update({ topics: next });
    track("search", { kind: "topic", topic, workspaceId: current?._id });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  const clear = () => {
    setDraft("");
    update({ q: null, ask: false, topics: [] });
    inputRef.current?.focus();
  };

  if (!current) return null;

  // What the results list shows, in order.
  let list: Array<{ insight: Insight; cite?: number; why?: string | null; snippet?: string | null }> = [];
  let heading = "";
  if (showingAnswer && askQuery.data) {
    const cited = askQuery.data.insights.flatMap((hit, i) => {
      const insight = byId.get(hit.id);
      return insight ? [{ insight, cite: askQuery.data!.mode === "ai" ? i + 1 : undefined, why: hit.why }] : [];
    });
    list = cited;
    heading = askQuery.data.mode === "ai" ? (cited.length ? "Sources" : "") : "";
  } else if (typed) {
    list = ranked.map((r) => ({ insight: r.insight, snippet: r.snippet }));
    heading = `${list.length} ${list.length === 1 ? "insight matches" : "insights match"}`;
  } else if (activeTopics.length) {
    list = pool.map((insight) => ({ insight }));
    heading = `${list.length} ${list.length === 1 ? "insight" : "insights"} about ${activeTopics.map(topicLabel).join(" and ")}`;
  }
  const browsing = !typed && !showingAnswer && activeTopics.length === 0;
  const topicList = showAllTopics ? counts : counts.slice(0, TOPICS_SHOWN);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:py-10">
      <PageHeader eyebrow={current.name} title="Explore your research" description="Browse by topic, search by any word, or ask a question and get an answer that points to the insights behind it." />

      <form onSubmit={onSubmit} role="search" className="mt-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="explore-input" className="sr-only">Ask a question or search</label>
          <Input
            ref={inputRef}
            id="explore-input"
            data-tour="explore-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question, like “Why do people cancel?”, or type a word"
            autoComplete="off"
            className="h-12 bg-card pl-11 pr-10 text-base"
          />
          {(draft || activeTopics.length > 0) && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" className="h-12 px-5 text-base font-semibold" disabled={draft.trim().length < 2 || askQuery.isFetching}>
          {askQuery.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Ask
        </Button>
      </form>
      <p className="mt-2 text-sm text-muted-foreground">Matches update as you type. Press Ask for a written answer.</p>

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <main className="min-w-0 space-y-4">
          {counts.length > 0 && (
            <div className="-mx-5 overflow-x-auto px-5 pb-1 lg:hidden" role="group" aria-label="Topics">
              <div className="flex w-max gap-2">
                {counts.slice(0, 20).map(({ topic, count }) => (
                  <TopicChip key={topic} topic={topic} count={count} active={activeTopics.includes(topic)} onClick={() => toggleTopic(topic)} />
                ))}
              </div>
            </div>
          )}
          {showingAnswer && <AnswerPanel result={askQuery.data} question={asked} loading={askQuery.isFetching} topics={activeTopics} />}
          {showingAnswer && askQuery.isError && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              {askQuery.error instanceof Error ? askQuery.error.message : "That question didn’t go through."}{" "}
              <button type="button" onClick={() => void askQuery.refetch()} className="cursor-pointer font-semibold underline underline-offset-4">Try again</button>
            </p>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
            </div>
          ) : insights.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8">
              <h2 className="text-lg font-bold">Nothing to explore yet</h2>
              <p className="mt-1 max-w-md text-muted-foreground">Insights from your published studies show up here, tagged by topic, as soon as a study is generated.</p>
            </div>
          ) : browsing ? (
            <>
              <section aria-labelledby="try-heading">
                <h2 id="try-heading" className="text-sm font-semibold text-muted-foreground">Try asking</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium hover:border-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {q} <ArrowRight className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
              <h2 className="pt-4 text-sm font-semibold text-muted-foreground">Newest insights</h2>
              <ul className="space-y-3">
                {insights.slice(0, 12).map((insight) => (
                  <li key={insight.id}>
                    <InsightCard insight={insight} activeTopics={activeTopics} onTopic={toggleTopic} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {heading && <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>}
              {list.length === 0 && !askQuery.isFetching && !showingAnswer ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-6">
                  <p className="font-semibold">No insights match{typed ? ` “${typed}”` : ""}{activeTopics.length ? ` in ${activeTopics.map(topicLabel).join(" and ")}` : ""}.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {typed ? "Press Ask to search by meaning instead of exact words." : "Try another topic."}
                    {activeTopics.length > 0 && (
                      <>
                        {" "}
                        <button type="button" onClick={() => update({ topics: [] })} className="cursor-pointer font-medium text-foreground underline underline-offset-4">Clear topics</button>
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <ol className="space-y-3">
                  {list.map((item) => (
                    <li key={item.insight.id}>
                      <InsightCard {...item} activeTopics={activeTopics} onTopic={toggleTopic} />
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </main>

        <aside aria-labelledby="topics-heading" className="hidden lg:block">
          <div className="lg:sticky lg:top-6">
            <h2 id="topics-heading" className="text-sm font-semibold">Topics</h2>
            {tagging === "running" && untagged > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Adding topics to {untagged} {untagged === 1 ? "insight" : "insights"}
              </p>
            )}
            {counts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{isLoading || tagging === "running" ? "Loading topics…" : "No topics yet."}</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topicList.map(({ topic, count }) => (
                    <TopicChip key={topic} topic={topic} count={count} active={activeTopics.includes(topic)} onClick={() => toggleTopic(topic)} />
                  ))}
                </div>
                {counts.length > TOPICS_SHOWN && (
                  <button type="button" onClick={() => setShowAllTopics((v) => !v)} className="mt-3 cursor-pointer text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
                    {showAllTopics ? "Show fewer" : `Show all ${counts.length} topics`}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
