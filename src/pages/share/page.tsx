import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import Logo from "@/components/logo.tsx";
import ReelFeed from "../feed/_components/reel-feed.tsx";
import { FeedModeContext, type FeedMode } from "../feed/_lib/feed-mode.ts";

export default function SharePage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();

  const { data } = useQuery({
    queryKey: ["share", "feed", token],
    queryFn: () => api.share.feed({ token }),
    enabled: !!token,
  });

  const mode = useMemo<FeedMode>(() => ({ kind: "share", token }), [token]);

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

  const header = (
    <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent px-3 py-3 lg:max-w-[calc(100dvh*9/16)] lg:mx-auto">
      <div className="flex items-center gap-2 text-white">
        <Logo withText={false} />
        <span className="truncate text-sm font-semibold">{data?.studyTitle ?? ""}</span>
      </div>
    </div>
  );

  return (
    <FeedModeContext.Provider value={mode}>
      <div className="dark relative h-dvh">
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
        <Link
          to="/signin"
          className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white lg:bottom-6"
        >
          Made with repofeed
        </Link>
      </div>
    </FeedModeContext.Provider>
  );
}
