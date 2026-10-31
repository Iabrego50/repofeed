import type { StudyStatus } from "@/convex/schema/validators.ts";
import { cn } from "@/lib/utils.ts";

const STYLE: Record<StudyStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-secondary text-muted-foreground" },
  generating: { label: "Generating", cls: "bg-[#4FA3FF]/15 text-[#4FA3FF]" },
  review: { label: "In review", cls: "bg-[#FFC23D]/15 text-[#FFC23D]" },
  published: { label: "Published", cls: "bg-[#3FE0A0]/15 text-[#3FE0A0]" },
  archived: { label: "Archived", cls: "bg-secondary text-muted-foreground" },
};

export default function StatusBadge({ status }: { status: StudyStatus }) {
  const s = STYLE[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider", s.cls)}>
      {s.label}
    </span>
  );
}
