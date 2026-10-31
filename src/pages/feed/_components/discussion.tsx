import { useState } from "react";
import { useMutation } from '@/lib/convex-compat';
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, CircleDot, CornerDownRight, MessageSquare, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CommentKind } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import UserAvatar from "@/components/user-avatar.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";
import type { FeedComment } from "../_lib/types.ts";
import { useFeedMode } from "../_lib/feed-mode.ts";
import { GuestDismissed, useFeedActions, useReelComments } from "../_lib/use-feed-data.ts";

type Comment = FeedComment;

const KINDS: Array<{ key: CommentKind; label: string; cls: string }> = [
  { key: "note", label: "Note", cls: "bg-secondary text-foreground" },
  { key: "question", label: "Question", cls: "bg-[#B98CFF]/15 text-[#B98CFF]" },
  { key: "action", label: "Action item", cls: "bg-primary/15 text-primary" },
];
const kindMeta = (k: CommentKind) => KINDS.find((x) => x.key === k) ?? KINDS[0];

function Composer({ reelId, parentId, onDone, autoFocus }: { reelId: Id<"reels">; parentId?: Id<"comments">; onDone?: () => void; autoFocus?: boolean }) {
  const { addComment: add } = useFeedActions();
  const [kind, setKind] = useState<CommentKind>(parentId ? "note" : "question");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await add({ reelId, kind, body, parentId });
      setBody("");
      onDone?.();
    } catch (err) {
      if (err instanceof GuestDismissed) return;
      toast.error(errorMessage(err, "Couldn't post your comment"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div role="radiogroup" aria-label="Comment type" className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={kind === k.key}
            onClick={() => setKind(k.key)}
            className={cn(
              "min-h-9 cursor-pointer rounded-full border border-border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              kind === k.key ? k.cls + " border-transparent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <Textarea
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) void submit();
        }}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        placeholder={parentId ? "Write a reply…" : "Ask a question, add a note or log an action…"}
        aria-label={parentId ? "Reply" : "New comment"}
      />
      <div className="flex justify-end gap-2">
        {onDone && parentId && <Button type="button" variant="ghost" className="h-10" onClick={onDone}>Cancel</Button>}
        <Button type="submit" className="h-10" disabled={busy || !body.trim()}>
          {busy && <Spinner />} {parentId ? "Reply" : "Post"}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({ c, replies, reelId }: { c: Comment; replies: Comment[]; reelId: Id<"reels"> }) {
  const setResolved = useMutation(api.feed.setResolved);
  const { deleteComment: remove } = useFeedActions();
  const [replying, setReplying] = useState(false);
  const meta = kindMeta(c.kind);
  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <UserAvatar name={c.author.name} src={c.author.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold">{c.author.name}</span>
            {c.author.isGuest && (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground">Guest</span>
            )}
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c._creationTime), { addSuffix: true })}</span>
            <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase", meta.cls)}>{meta.label}</span>
            {c.kind !== "note" && c.resolved && (
              <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[#3FE0A0]">
                <CheckCircle2 className="size-3" /> Resolved
              </span>
            )}
          </div>
          <p className={cn("mt-1 whitespace-pre-wrap break-words text-sm", c.resolved && "text-muted-foreground")}>{c.body}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {!c.parentId && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => setReplying((v) => !v)}>
                <CornerDownRight className="size-3.5" /> Reply
              </Button>
            )}
            {c.canResolve && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => void setResolved({ commentId: c._id, resolved: !c.resolved })}>
                {c.resolved ? <CircleDot className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                {c.resolved ? "Reopen" : "Resolve"}
              </Button>
            )}
            {c.canDelete && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" aria-label="Delete comment" onClick={() => void remove(c._id).catch(() => undefined)}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {(replies.length > 0 || replying) && (
        <ul className="ml-11 space-y-3 border-l border-border pl-4">
          {replies.map((r) => (
            <CommentItem key={r._id} c={r} replies={[]} reelId={reelId} />
          ))}
          {replying && (
            <li>
              <Composer reelId={reelId} parentId={c._id} autoFocus onDone={() => setReplying(false)} />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function Discussion({ reelId }: { reelId: Id<"reels"> }) {
  const comments = useReelComments(reelId);
  const mode = useFeedMode();
  const top = comments?.filter((c) => !c.parentId) ?? [];
  const repliesOf = (id: Id<"comments">) => comments?.filter((c) => c.parentId === id) ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {comments === undefined ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-full" /></div>
              </div>
            ))}
          </div>
        ) : top.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
              <EmptyTitle>No discussion yet</EmptyTitle>
              <EmptyDescription>
                {mode.kind === "share" ? "Be the first to react or ask a question." : "Ask a question or log an action item for the team."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-5" aria-live="polite">
            {top.map((c) => (
              <CommentItem key={c._id} c={c} replies={repliesOf(c._id)} reelId={reelId} />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border p-4">
        <Composer reelId={reelId} />
      </div>
    </div>
  );
}
