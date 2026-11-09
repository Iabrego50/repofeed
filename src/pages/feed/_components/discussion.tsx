import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CornerDownRight, Loader2, MessageSquare, Trash2 } from "lucide-react";
import type { CommentKind } from "@/schema/validators.ts";
import type { Comment } from "@/lib/api/mappers";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import UserAvatar from "@/components/user-avatar.tsx";
import { cn } from "@/lib/utils.ts";
import { track } from "@/lib/analytics";

type CommentWithReplies = Comment & { replies?: CommentWithReplies[] };

export type AddCommentArgs = {
  reelId: string;
  kind: CommentKind;
  body: string;
  parentId?: string;
};

function buildCommentTree(comments: Comment[]): CommentWithReplies[] {
  const commentMap = new Map<string, CommentWithReplies>();
  const roots: CommentWithReplies[] = [];

  comments.forEach((comment) => {
    commentMap.set(comment._id, { ...comment, replies: [] });
  });

  comments.forEach((comment) => {
    const node = commentMap.get(comment._id)!;
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

const KINDS: Array<{ key: CommentKind; label: string; cls: string }> = [
  { key: "note", label: "Note", cls: "bg-secondary text-foreground" },
  { key: "question", label: "Question", cls: "bg-[#B98CFF]/15 text-[#B98CFF]" },
  { key: "action", label: "Action", cls: "bg-[#FF8C8C]/15 text-[#FF8C8C]" },
];
const kindMeta = (k: CommentKind) => KINDS.find((x) => x.key === k) ?? KINDS[0];

function Composer({
  reelId,
  parentId,
  onDone,
  autoFocus,
  onAddComment,
}: {
  reelId: string;
  parentId?: string;
  onDone?: () => void;
  autoFocus?: boolean;
  onAddComment?: (args: AddCommentArgs) => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<CommentKind>("note");
  const [body, setBody] = useState("");
  const local = Boolean(onAddComment);

  const addMutation = useMutation({
    mutationFn: () => api.feed.addComment({ reelId, kind, body, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", "comments", reelId] });
      track("comment", { reelId, kind });
      setBody("");
      onDone?.();
      toast.success("Comment posted");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't post your comment",
      );
    },
  });

  const submit = () => {
    if (!body.trim()) return;
    if (onAddComment) {
      onAddComment({ reelId, kind, body: body.trim(), parentId });
      setBody("");
      onDone?.();
      return;
    }
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
      <div
        role="radiogroup"
        aria-label="Comment type"
        className="flex flex-wrap gap-1.5"
      >
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={kind === k.key}
            onClick={() => setKind(k.key)}
            className={cn(
              "min-h-9 cursor-pointer rounded-full border border-border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              kind === k.key
                ? k.cls + " border-transparent"
                : "text-muted-foreground hover:text-foreground",
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
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim())
            submit();
        }}
        placeholder={
          parentId ? "Add a reply…" : "Ask a question or leave a note…"
        }
        rows={parentId ? 2 : 3}
        disabled={!local && addMutation.isPending}
      />
      <Button
        type="submit"
        disabled={!body.trim() || (!local && addMutation.isPending)}
        size="sm"
      >
        {!local && addMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageSquare className="size-4" />
        )}
        Post
      </Button>
    </form>
  );
}

function CommentCard({
  comment,
  reelId,
  level,
  onAddComment,
}: {
  comment: CommentWithReplies;
  reelId: string;
  level: number;
  onAddComment?: (args: AddCommentArgs) => void;
}) {
  const [replying, setReplying] = useState(false);
  const local = Boolean(onAddComment);

  const deleteMutation = {
    mutate: () => console.log("Delete not implemented"),
    isPending: false,
  };

  const meta = kindMeta(comment.kind);
  const safeLevel = Math.min(level, 3);

  return (
    <div
      className={cn(
        "space-y-2",
        safeLevel > 0 && "ml-6 border-l-2 border-border pl-3",
      )}
    >
      <div className="flex items-start gap-2">
        <UserAvatar
          name={comment.author?.name || "User"}
          src={comment.author?.avatar}
          className="size-8 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">
              {comment.author?.name || "User"}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                meta.cls,
              )}
            >
              {meta.label}
            </span>
            <time className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment._creationTime), {
                addSuffix: true,
              })}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplying(!replying)}
            >
              <CornerDownRight className="size-3" />
              Reply
            </Button>
            {!local && (
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
          <Composer
            reelId={reelId}
            parentId={comment._id}
            onDone={() => setReplying(false)}
            autoFocus
            onAddComment={onAddComment}
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply._id}
              comment={reply}
              reelId={reelId}
              level={level + 1}
              onAddComment={onAddComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DiscussionProps {
  reelId: string;
  comments?: Comment[];
  onAddComment?: (args: AddCommentArgs) => void;
  footer?: ReactNode;
}

export default function Discussion({
  reelId,
  comments: localComments,
  onAddComment,
  footer,
}: DiscussionProps) {
  const local = localComments !== undefined;
  const { data: fetched, isLoading } = useQuery({
    queryKey: ["feed", "comments", reelId],
    queryFn: () => api.feed.getComments({ reelId }),
    enabled: !local,
  });

  if (!local && isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const comments = local ? localComments : fetched;
  const topLevel = comments ? buildCommentTree(comments) : [];

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      <Composer reelId={reelId} onAddComment={onAddComment} />
      {footer}

      {topLevel.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>No comments yet</EmptyTitle>
            <EmptyDescription>
              Be the first to share your thoughts
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <CommentCard
              key={comment._id}
              comment={comment}
              reelId={reelId}
              level={0}
              onAddComment={onAddComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
