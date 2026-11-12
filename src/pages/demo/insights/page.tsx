import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Info, Play, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import PageHeader from "@/components/page-header.tsx";
import PublicShell from "@/components/public-shell.tsx";
import { SAMPLE_STUDY } from "../_lib/sample.ts";
import InsightsDashboard, { AudienceToggle } from "@/pages/insights/_components/insights-dashboard.tsx";
import type { Audience } from "@/pages/insights/_lib/columns.ts";
import { DEMO_INSIGHT_SUMMARY } from "../_lib/demo-insights.ts";

const reelHref = (id: string) => `/demo?scene=${id}`;

/** Public sample Insights dashboard for the demo study, using made-up numbers. */
export default function DemoInsightsPage() {
  const [audience, setAudience] = useState<Audience>("everyone");
  return (
    <PublicShell
      wide
      actions={
        <Button asChild variant="secondary" className="h-11">
          <Link to="/demo" aria-label="Demo feed"><Play className="size-4" /> <span className="hidden sm:inline">Demo feed</span></Link>
        </Button>
      }
    >
      <div className="px-4 pt-2 sm:px-5">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-6 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            This is a sample. The numbers are made up to show what you'd see once your team watches <span className="font-semibold">{SAMPLE_STUDY.title}</span>.
          </span>
        </motion.p>
        <PageHeader
          eyebrow="Insights demo"
          title="Was the research watched?"
          description="Reach, completion and reactions across the demo study's scenes."
          actions={
            <>
              <Button asChild variant="outline" className="h-11">
                <Link to="/demo/deck"><Presentation className="size-4" /> Create readout deck</Link>
              </Button>
              <SignInButton className="h-11 font-semibold" signInText="Get this for your research" />
            </>
          }
        />
        <div className="mt-5 sm:mt-6">
          <AudienceToggle value={audience} onChange={setAudience} />
        </div>
        <InsightsDashboard summary={DEMO_INSIGHT_SUMMARY} audience={audience} showStudy={false} reelHref={reelHref} />
      </div>
    </PublicShell>
  );
}
