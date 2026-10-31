import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";

/** Small "What's this?" icon that explains a tricky spot and links to the full Help Center article. */
export default function HelpHint({ title, children, article, className }: { title: string; children: ReactNode; article?: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`What's this: ${title}`}
        className={cn(
          "inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        <CircleHelp className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" align="start">
        <p className="font-semibold">{title}</p>
        <div className="mt-1.5 leading-relaxed text-muted-foreground">{children}</div>
        {article && (
          <Link to={`/help?article=${article}`} className="mt-3 inline-flex cursor-pointer items-center gap-1 font-medium text-primary hover:underline">
            Read more <ArrowRight className="size-3.5" />
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
