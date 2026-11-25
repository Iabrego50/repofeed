import { Link } from "react-router-dom";
import Logo from "@/components/logo.tsx";
import NativeViewerAccountMenu from "@/components/native-viewer-account-menu.tsx";
import {
  DIVISION_CHANNEL_CODES,
  DIVISION_HINTS,
  DIVISION_LABELS,
  DIVISION_SLUGS,
  divisionFeedPath,
  type DivisionSlug,
} from "@/lib/divisions.ts";

/**
 * Native black home: five division channels (CH 01–05). Each opens its own feed.
 */
export default function DivisionHomePage() {
  return (
    <div className="dark flex h-dvh flex-col bg-studio text-white">
      <header className="flex items-center gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo className="text-white" />
        <NativeViewerAccountMenu />
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-eyebrow uppercase">Channels</p>
        <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-white">Pick a division</h1>
        <p className="mt-2 max-w-xs text-center text-sm text-white/55">
          Each feed is curated separately by your research team.
        </p>

        <ul className="mt-10 flex w-full max-w-sm flex-col gap-2.5">
          {DIVISION_SLUGS.map((slug) => (
            <li key={slug}>
              <DivisionPill slug={slug} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function DivisionPill({ slug }: { slug: DivisionSlug }) {
  return (
    <Link
      to={divisionFeedPath(slug)}
      className="flex min-h-14 w-full cursor-pointer items-center justify-between rounded-2xl border border-white/12 bg-white/[0.05] px-5 text-left transition-colors hover:border-mark/50 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]"
    >
      <span className="flex flex-col">
        <span className="font-mono text-[10px] tracking-[0.14em] text-mark">{DIVISION_CHANNEL_CODES[slug]}</span>
        <span className="text-base font-semibold tracking-wide text-white">{DIVISION_LABELS[slug]}</span>
      </span>
      <span className="text-xs font-medium text-white/45">{DIVISION_HINTS[slug]}</span>
    </Link>
  );
}
