import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ear, Play, Radio } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { markViewerOnboardingComplete } from "@/lib/story-onboarding.ts";
import { cn } from "@/lib/utils.ts";

const STEPS = [
  {
    id: "invite",
    eyebrow: "You were invited",
    title: "Your team’s research plays here.",
    body: "Someone on the research team sent you a short join code. Once you’re in, insight scenes land in a channel feed — same findings, one conversation.",
    icon: Radio,
  },
  {
    id: "watch",
    eyebrow: "How it works",
    title: "Scroll. React. Ask.",
    body: "Each scene is a short finding with the quote and source attached. Like it, comment, or tap Heard this before — no decks to dig through.",
    icon: Ear,
  },
  {
    id: "join",
    eyebrow: "Next",
    title: "Enter the join code.",
    body: "Ask your researcher for the eight-character code from Workspace settings. You’ll land in their division channels and start watching.",
    icon: Play,
  },
] as const;

/**
 * Native (iOS) viewer-only onboarding. No pricing, no researcher signup —
 * just enough context before `/join` and the division home.
 */
export default function ViewerOnboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const Icon = step.icon;
  const last = index === STEPS.length - 1;

  const finish = () => {
    markViewerOnboardingComplete();
    navigate("/join", { replace: true });
  };

  return (
    <div className="dark flex h-dvh flex-col bg-studio text-white">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo className="text-white" />
        <button
          type="button"
          className="cursor-pointer font-mono text-[11px] tracking-[0.12em] text-white/55 uppercase hover:text-white"
          onClick={finish}
        >
          Skip
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-8 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn("h-1 flex-1 rounded-full", i <= index ? "bg-mark" : "bg-white/15")}
            />
          ))}
        </div>

        <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">{step.eyebrow}</p>
        <div className="mt-5 grid size-14 place-items-center rounded-2xl bg-studio-panel text-mark">
          <Icon className="size-7" strokeWidth={2} />
        </div>
        <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight">{step.title}</h1>
        <p className="mt-3 text-pretty text-base leading-relaxed text-white/65">{step.body}</p>

        <div className="mt-10 flex gap-2">
          {index > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 border-white/20 bg-transparent px-5 font-semibold text-white hover:bg-white/10 hover:text-white"
              onClick={() => setIndex((i) => i - 1)}
            >
              Back
            </Button>
          )}
          <Button type="button" className="h-11 flex-1 px-5 font-semibold" onClick={() => (last ? finish() : setIndex((i) => i + 1))}>
            {last ? "Enter join code" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
