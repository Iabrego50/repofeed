import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bookmark, Clapperboard, Compass, Sparkles, Tag, FolderPlus, Layers, LifeBuoy, Presentation, Quote, Settings } from "lucide-react";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { searchReels } from "@/pages/feed/_lib/search.ts";
import { topicCounts, topicLabel } from "@/lib/research-search.ts";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command.tsx";

/** Any part of the app can open search with `openSearch()`. */
export const OPEN_SEARCH_EVENT = "repofeed:open-search";
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
}

/**
 * One search box for the whole workspace: jump to a page, open a study, or find
 * a scene by anything said in it, including the words inside a quote.
 */
export default function CommandPalette() {
  const { current, isEditor } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (cmdK || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault();
        setOpen((v) => (cmdK ? !v : true));
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  const { data: reels } = useQuery({
    queryKey: ["feed", "list", current?._id, undefined],
    queryFn: () => api.feed.list({ workspaceId: current!._id }),
    enabled: !!current && open,
    staleTime: 60_000,
  });
  const { data: studies } = useQuery({
    queryKey: ["studies", "list", current?._id],
    queryFn: () => api.studies.list({ workspaceId: current!._id }),
    enabled: !!current && open,
    staleTime: 60_000,
  });

  const hits = useMemo(() => {
    if (!reels || query.trim().length < 2) return [];
    return searchReels(
      reels.map((r) => ({ ...r, studyTitle: r.studyTitle ?? "", scenes: r.scenes ?? [] })),
      query,
    ).slice(0, 12);
  }, [reels, query]);

  const topicHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!reels || q.length < 2) return [];
    return topicCounts(reels.map((r) => ({ topics: r.topics ?? [] })))
      .filter((t) => t.topic.includes(q))
      .slice(0, 5);
  }, [reels, query]);

  const studyHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = studies ?? [];
    return (q ? list.filter((s) => s.title.toLowerCase().includes(q)) : list).slice(0, 6);
  }, [studies, query]);

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate(to);
  };

  const pages = [
    { to: "/feed", label: "Feed", icon: Clapperboard },
    { to: "/feed?view=saved", label: "Saved scenes", icon: Bookmark },
    { to: "/explore", label: "Explore and ask", icon: Compass },
    ...(isEditor
      ? [
          { to: "/studies", label: "Studies", icon: Layers },
          { to: "/studies/new", label: "New study", icon: FolderPlus },
          { to: "/insights", label: "Insights", icon: BarChart3 },
          { to: "/insights/deck", label: "Readout deck (PowerPoint)", icon: Presentation },
          { to: "/settings", label: "Workspace and people", icon: Settings },
        ]
      : []),
    { to: "/help", label: "Help Center", icon: LifeBuoy },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Find a scene, a study or a page"
      shouldFilter={false}
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search scenes, quotes, studies…" />
      <CommandList>
        <CommandEmpty>Nothing matches “{query}”. Try a word from the quote you remember.</CommandEmpty>
        {query.trim().length >= 3 && (
          <CommandGroup heading="Ask your research">
            <CommandItem value="ask-question" onSelect={() => go(`/explore?q=${encodeURIComponent(query.trim())}&ask=1`)}>
              <Sparkles className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Ask “{query.trim()}”</span>
              <span className="text-xs text-muted-foreground">Answer with sources</span>
            </CommandItem>
          </CommandGroup>
        )}
        {topicHits.length > 0 && (
          <CommandGroup heading="Topics">
            {topicHits.map((t) => (
              <CommandItem key={t.topic} value={`topic-${t.topic}`} onSelect={() => go(`/explore?topic=${encodeURIComponent(t.topic)}`)}>
                <Tag className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{topicLabel(t.topic)}</span>
                <span className="text-xs text-muted-foreground">{t.count} {t.count === 1 ? "insight" : "insights"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {hits.length > 0 && (
          <CommandGroup heading="Scenes">
            {hits.map(({ reel, snippet }) => (
              <CommandItem key={reel._id} value={`scene-${reel._id}`} onSelect={() => go(`/feed?reel=${reel._id}`)}>
                <Quote className="mt-0.5 size-4 self-start text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{reel.title}</span>
                  {snippet && <span className="quote-voice block truncate text-muted-foreground">{snippet}</span>}
                  <span className="block truncate text-xs text-muted-foreground">{reel.studyTitle}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {isEditor && studyHits.length > 0 && (
          <CommandGroup heading="Studies">
            {studyHits.map((s) => (
              <CommandItem key={s._id} value={`study-${s._id}`} onSelect={() => go(`/studies/${s._id}`)}>
                <Layers className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="text-xs capitalize text-muted-foreground">{s.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {pages.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase())).length > 0 && (
          <CommandGroup heading="Go to">
            {pages
              .filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()))
              .map((p) => (
                <CommandItem key={p.to} value={`page-${p.to}`} onSelect={() => go(p.to)}>
                  <p.icon className="size-4 text-muted-foreground" />
                  {p.label}
                  {p.to === "/studies/new" && <CommandShortcut>N</CommandShortcut>}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
