import type { StudyStatus } from "@/schema/validators.ts";
import { cn } from "@/lib/utils.ts";

const STYLE: Record<StudyStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-secondary text-muted-foreground" },
  generating: { label: "Generating", cls: "bg-primary/15 text-primary" },
  review: { label: "In review", cls: "bg-warning/15 text-warning" },
  published: { label: "Published", cls: "bg-success/15 text-success" },
  archived: { label: "Archived", cls: "bg-secondary text-muted-foreground" },
};

export default function StatusBadge({ status }: { status: StudyStatus }) {
  const s = STYLE[status];
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold", s.cls)}>
      {s.label}
    </span>
  );
}
