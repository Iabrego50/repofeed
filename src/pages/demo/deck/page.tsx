import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { track } from "@/lib/analytics";
import { Generating, Presenter } from "@/pages/insights/deck/page.tsx";
import { buildDemoDeck } from "../_lib/demo-deck.ts";
import { SAMPLE_STUDY } from "../_lib/sample.ts";

const BACK = "/demo/insights";

/**
 * Public sample of the readout deck. Visitors press "Generate deck", wait a few
 * seconds, then page through the slides and download the PowerPoint file, the
 * same flow an editor gets for a real study.
 */
export default function DemoDeckPage() {
  const [state, setState] = useState<"idle" | "busy" | "ready">("idle");
  const deck = useMemo(() => buildDemoDeck(), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const generate = () => {
    track("demo_open", { location: "demo_deck_generate" });
    setState("busy");
    timer.current = setTimeout(() => setState("ready"), 5000);
  };

  if (state === "busy") {
    return (
      <div className="dark flex h-dvh flex-col bg-background">
        <Generating backTo={BACK} />
      </div>
    );
  }

  if (state === "ready") {
    return (
      <div className="dark flex h-dvh flex-col bg-background">
        <Presenter
          deck={deck}
          backTo={BACK}
          onRegenerate={generate}
          extra={<SignInButton className="hidden h-10 font-semibold md:inline-flex" signInText="Make one from my research" />}
        />
      </div>
    );
  }

  return (
    <div className="dark flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-5">
        <Button asChild variant="ghost" className="h-10 px-2 sm:px-3">
          <Link to={BACK}><ArrowLeft className="size-4" /> <span className="hidden sm:inline">Insights</span></Link>
        </Button>
      </header>
      <div className="m-auto p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Presentation /></EmptyMedia>
            <EmptyTitle>Turn the sample study into a readout deck</EmptyTitle>
            <EmptyDescription>
              You get a short deck of findings from <span className="font-medium text-foreground">{SAMPLE_STUDY.title}</span>, each backed by a quote or a figure from its scenes, plus recommendations. Page through it here or download it as an editable PowerPoint file.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-11 font-semibold" onClick={generate}><Sparkles className="size-4" /> Generate deck</Button>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}
