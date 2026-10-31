// @ts-nocheck
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from '@/lib/convex-compat';
import { Link2Off, UserRound, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import Logo from "@/components/logo.tsx";
import { errorMessage } from "@/lib/errors.ts";
import ReelFeed from "../feed/_components/reel-feed.tsx";
import { FeedModeContext, type FeedMode } from "../feed/_lib/feed-mode.ts";
import NamePrompt from "./_components/name-prompt.tsx";

const secretKey = (token: string) => `fieldreel.guest.${token}`;
const welcomeKey = (token: string) => `fieldreel.shareWelcome.${token}`;

/** Public, view-only feed for a share link. Viewers name themselves only when they interact. */
export default function SharePage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem(secretKey(token)));
  const data = useQuery(api.share.feed, { token, secret: secret ?? undefined });
  const join = useMutation(api.share.join);
  const [prompting, setPrompting] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !localStorage.getItem(welcomeKey(token)));
  // Pending interactions wait on the name prompt and resume once it closes.
  const waiters = useRef<Array<(s: string | null) => void>>([]);

  const settle = (value: string | null) => {
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((w) => w(value));
    setPrompting(false);
  };

  // A stored secret that no longer matches a guest (e.g. link reset) is dropped.
  const knownGuest = data?.guest ?? null;
  const validSecret = data === undefined ? secret : knownGuest ? secret : null;

  const ensureGuest = useCallback((): Promise<string | null> => {
    if (validSecret) return Promise.resolve(validSecret);
    return new Promise((resolve) => {
      waiters.current.push(resolve);
      setPrompting(true);
    });
  }, [validSecret]);

  const mode = useMemo<FeedMode>(
    () => ({ kind: "share", token, secret: validSecret, ensureGuest }),
    [token, validSecret, ensureGuest],
  );

  if (data === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-5">
        <Logo />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Link2Off /></EmptyMedia>
            <EmptyTitle>This link isn't available</EmptyTitle>
            <EmptyDescription>It may have been turned off or the study was unpublished. Ask the person who sent it for a new link.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="secondary" className="h-11"><Link to="/">Go to repofeed.ai</Link></Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const dismissWelcome = () => {
    localStorage.setItem(welcomeKey(token), "1");
    setWelcomeOpen(false);
  };

  const header = (
    <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent px-3 py-3 lg:max-w-[calc(100dvh*9/16+5rem)] lg:mx-auto">
     <div className="flex items-center justify-between gap-3">
      <Link to="/" className="flex min-w-0 cursor-pointer items-center gap-2 text-white" aria-label="repofeed.ai home">
        <Logo withText={false} />
        <span className="truncate text-sm font-semibold">{data?.studyTitle ?? ""}</span>
      </Link>
      {knownGuest ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          <UserRound className="size-3.5" /> {knownGuest.name}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-black/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
          View only
        </span>
      )}
     </div>
      {welcomeOpen && data && data.reels.length > 0 && (
        <div role="note" className="mt-3 flex items-start gap-3 rounded-xl bg-black/60 p-3 text-sm text-white backdrop-blur">
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-semibold">Welcome!</span> Swipe or scroll to watch each finding. Use the buttons on the right to react, comment or see the evidence behind a scene. You'll only be asked for your name when you react or comment.
          </p>
          <button type="button" onClick={dismissWelcome} aria-label="Dismiss welcome note" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <FeedModeContext.Provider value={mode}>
      <div className="h-dvh">
        <ReelFeed
          reels={data?.reels}
          deepLink={params.get("reel")}
          toolbar={header}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No scenes here yet</EmptyTitle>
                <EmptyDescription>Check back later.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </div>
      <NamePrompt
        open={prompting}
        studyTitle={data?.studyTitle ?? "this study"}
        onCancel={() => settle(null)}
        onSubmit={async (name) => {
          try {
            const res = await join({ token, name });
            localStorage.setItem(secretKey(token), res.secret);
            setSecret(res.secret);
            settle(res.secret);
          } catch (err) {
            throw new Error(errorMessage(err, "Couldn't save your name"), { cause: err });
          }
        }}
      />
    </FeedModeContext.Provider>
  );
}
