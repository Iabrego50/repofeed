import { Link } from "react-router-dom";
import { Info, Play } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import PublicShell from "@/components/public-shell.tsx";
import ExploreView from "@/pages/explore/_components/explore-view.tsx";
import { SAMPLE_STUDY } from "../_lib/sample.ts";
import {
  DEMO_SUGGESTED_QUESTIONS,
  askDemoResearch,
  demoInsights,
  demoWatchHref,
} from "../_lib/demo-explore.ts";

const INSIGHTS = demoInsights();

/** Public sample of Explore: search and ask against the fictional Supperly study. */
export default function DemoExplorePage() {
  return (
    <PublicShell
      wide
      actions={
        <>
          <Button asChild variant="secondary" className="h-11">
            <Link to="/demo" aria-label="Demo feed"><Play className="size-4" /> <span className="hidden sm:inline">Demo feed</span></Link>
          </Button>
          <Button asChild variant="secondary" className="h-11">
            <Link to="/demo/insights">Insights</Link>
          </Button>
        </>
      }
    >
      <ExploreView
        insights={INSIGHTS}
        eyebrow="Explore demo"
        title="Search the sample study"
        description="Browse by topic, type a word, or ask a question. The answers come from the fictional Supperly study, the same scenes as the demo feed."
        banner={
          <p className="mb-6 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              This is a sample. You are searching <span className="font-semibold">{SAMPLE_STUDY.title}</span> in the browser. Nothing here is your workspace, and nothing is sent to the signed-in Ask API.
            </span>
          </p>
        }
        headerActions={<SignInButton className="h-11 font-semibold" signInText="Search your own research" />}
        suggested={DEMO_SUGGESTED_QUESTIONS}
        watchHref={demoWatchHref}
        performAsk={({ question, topics }) => Promise.resolve(askDemoResearch(question, topics))}
        askKey="demo"
        trackMeta={{ demo: true }}
        sample
      />
    </PublicShell>
  );
}
