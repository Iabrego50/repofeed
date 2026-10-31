import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

interface FeedSearchProps {
  workspaceId: string;
  onSelectReel: (reelId: string) => void;
}

export default function FeedSearch({ workspaceId, onSelectReel }: FeedSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ["feed", "search", workspaceId, query],
    queryFn: () => api.feed.search({ workspaceId, query }),
    enabled: query.length >= 2,
  });

  const handleSelect = (reelId: string) => {
    onSelectReel(reelId);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search scenes..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="h-11 pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-9 -translate-y-1/2"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !results || results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No scenes found matching "{query}"
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((reel: any) => (
                <li key={reel._id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(reel._id)}
                    className="flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{reel.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {reel.snippet}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reel.studyTitle}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
