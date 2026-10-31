// @ts-nocheck
import { useState } from "react";
import { useAction, useMutation } from '@/lib/convex-compat';
import { toast } from "sonner";
import { Archive, ArchiveRestore, EllipsisVertical, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { errorMessage } from "@/lib/errors.ts";

type Props = {
  studyId: Id<"studies">;
  title: string;
  archived: boolean;
  isDemo: boolean;
};

/** Archive / restore / delete menu for one study. */
export default function StudyActions({ studyId, title, archived, isDemo }: Props) {
  const archive = useMutation(api.studies.archive);
  const destroy = useMutation(api.studies.destroy);
  const restore = useAction(api.billing.actions.restoreStudy);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const run = async (fn: () => Promise<unknown>, done: string, fail: string) => {
    try {
      await fn();
      toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err, fail));
    }
  };

  const label = isDemo ? "demo study" : "study";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${title}`}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <EllipsisVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {archived ? (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => void run(() => restore({ studyId }), "Study restored. Publish it again to show it in the feed.", "Couldn't restore the study")}>
              <ArchiveRestore /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => setConfirm("archive")}>
              <Archive /> {isDemo ? "Remove demo" : "Archive"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="cursor-pointer" onSelect={() => setConfirm("delete")}>
            <Trash2 /> Delete forever
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? `Delete "${title}" forever?` : `Archive this ${label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "Its scenes, files, reactions, comments and share links are removed for good. This can't be undone."
                : "It leaves the feed, its share link stops working and it no longer counts toward your plan. You can restore it any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary" className="h-11">Cancel</AlertDialogCancel>
            {confirm === "delete" ? (
              <AlertDialogAction variant="destructive" className="h-11" onClick={() => void run(() => destroy({ studyId }), "Study deleted", "Couldn't delete the study")}>
                Delete forever
              </AlertDialogAction>
            ) : (
              <AlertDialogAction className="h-11" onClick={() => void run(() => archive({ studyId }), "Study archived", "Couldn't archive the study")}>
                Archive
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
