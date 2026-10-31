import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, CircleDot, CornerDownRight, Loader2, MessageSquare, Trash2 } from "lucide-react";
import type { CommentKind } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import UserAvatar from "@/components/user-avatar.tsx";
import { cn } from "@/lib/utils.ts";

interface Comment {
  _id: string;
  _creationTime: number;
  kind: CommentKind;
  body: string;
  author: {
    name: string;
    avatar?: string;
  };
  isMe?: boolean;
  replies?: Comment[];
}

const KINDS: Array<{ key: CommentKind; label: string; cls: string }> = [
  { key: "note", label: "Note", cls: "bg-secondary text-foreground" },
  { key: "question", label: "Question", cls: "bg-[#B98CFF]/15 text-[#B98CFF]" },
  { key: "action", label: "Action item", cls: "bg-primary/15 text-primary" },
];
const kindMeta = (k: CommentKind) => KINDS.find((x) => x.key === k) ?? KINDS[0];

function Composer({ reelId, parentId, onDone, autoFocus }: { reelId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CommentKind>(parentId ? "note" : "question");
  const [body, setBody] = useState("");

  const addMutation = useMutation({
    mutationFn: () => api.feed.addComment({ reelId, kind, body, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", "comments", reelId] });
      setBody("");
      onDone?.();
      toast.success("Comment posted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Couldn't post your comment");
    },
  });

  const submit = () => {
    if (!body.trim()) return;
    addMutation.mutate();
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
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
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) submit();
        }}
        placeholder={parentId ? "Add a reply…" : "Ask a question or leave a note…"}
        rows={parentId ? 2 : 3}
        disabled={addMutation.isPending}
      />
      <Button type="submit" disabled={!body.trim() || addMutation.isPending} size="sm">
        {addMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
        Post
      </Button>
    </form>
  );
}

function CommentCard({ comment, reelId, level }: { comment: Comment; reelId: string; level: number }) {
  const queryClient = useQueryClient();
  const [replying, setReplying] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.feed.deleteComment({ commentId: comment._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", "comments", reelId] });
      toast.success("Comment deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete comment");
    },
  });

  const meta = kindMeta(comment.kind);

  return (
    <div className={cn("space-y-2", level > 0 && "ml-6 border-l-2 border-border pl-3")}>
      <div className="flex items-start gap-2">
        <UserAvatar name={comment.author.name} src={comment.author.avatar} className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{comment.author.name}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>
              {meta.label}
            </span>
            <time className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment._creationTime), { addSuffix: true })}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReplying(!replying)}>
              <CornerDownRight className="size-3" />
              Reply
            </Button>
            {comment.isMe && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {replying && (
        <div className="ml-10">
          <Composer reelId={reelId} parentId={comment._id} onDone={() => setReplying(false)} autoFocus />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard key={reply._id} comment={reply} reelId={reelId} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DiscussionProps {
  reelId: string;
}

export default function Discussion({ reelId }: DiscussionProps) {
  const { data: comments, isLoading } = useQuery({
    queryKey: ["feed", "comments", reelId],
    queryFn: () => api.feed.comments({ reelId }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const topLevel = comments?.filter((c: Comment) => !c.replies) || [];

  return (
    <div className="space-y-6 p-4">
      <Composer reelId={reelId} />

      {topLevel.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
            <EmptyTitle>No comments yet</EmptyTitle>
            <EmptyDescription>Be the first to share your thoughts</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment: Comment) => (
            <CommentCard key={comment._id} comment={comment} reelId={reelId} level={0} />
          ))}
        </div>
      )}
    </div>
  );
}
