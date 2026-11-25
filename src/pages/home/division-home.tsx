import { Link } from "react-router-dom";
import Logo from "@/components/logo.tsx";
import NativeViewerAccountMenu from "@/components/native-viewer-account-menu.tsx";
import {
  DIVISION_HINTS,
  DIVISION_LABELS,
  DIVISION_SLUGS,
  divisionFeedPath,
  type DivisionSlug,
} from "@/lib/divisions.ts";

/**
 * Native black home: five division pills. Each opens its own feed stream.
 */
export default function DivisionHomePage() {
  return (
    <div className="dark flex h-dvh flex-col bg-black text-white">
      <header className="flex items-center gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo className="text-white" />
        <NativeViewerAccountMenu />
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="text-xs font-semibold tracking-[0.18em] text-white/45 uppercase">Channels</p>
        <h1 className="mt-2 text-center font-serif text-3xl text-white">Pick a division</h1>
        <p className="mt-2 max-w-xs text-center text-sm text-white/55">
          Each feed is curated separately by your research team.
        </p>

        <ul className="mt-10 flex w-full max-w-sm flex-col gap-3">
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
      className="flex min-h-14 w-full cursor-pointer items-center justify-between rounded-full border border-white/15 bg-white/[0.06] px-6 text-left transition-colors hover:border-white/35 hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]"
    >
      <span className="text-base font-semibold tracking-wide text-white">{DIVISION_LABELS[slug]}</span>
      <span className="text-xs font-medium text-white/45">{DIVISION_HINTS[slug]}</span>
    </Link>
  );
}
