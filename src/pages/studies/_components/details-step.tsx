import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { api } from "@/convex/_generated/api.js";
import { UNTITLED_STUDY } from "@/convex/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { errorMessage } from "@/lib/errors.ts";

export type Details = { title: string; audience: string; goal: string };

export function DetailsFields({ value, onChange, disabled }: { value: Details; onChange: (d: Details) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
      <div className="space-y-2">
        <Label htmlFor="study-title">Study title</Label>
        <Input id="study-title" className="h-12" required maxLength={120} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Onboarding interviews, Q3" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-audience">Who is the feed for?</Label>
        <Input id="study-audience" className="h-12" required maxLength={200} value={value.audience} onChange={(e) => onChange({ ...value, audience: e.target.value })} placeholder="Product, growth and marketing leads" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-goal">What should they walk away knowing? <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="study-goal" rows={3} maxLength={300} value={value.goal} onChange={(e) => onChange({ ...value, goal: e.target.value })} placeholder="Why new users stall in week one" />
      </div>
    </fieldset>
  );
}

const isBlank = (study: Doc<"studies">) => !study.audience.trim() && (study.title === UNTITLED_STUDY || !study.title.trim());

export default function DetailsStep({ study, onSaved }: { study: Doc<"studies">; onSaved: () => void }) {
  const update = useMutation(api.studies.updateDetails);
  const suggest = useAction(api.generation.suggest.suggestDetails);
  const [value, setValue] = useState<Details>({
    title: study.title === UNTITLED_STUDY ? "" : study.title,
    audience: study.audience,
    goal: study.goal ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const autoRan = useRef(false);

  const runSuggest = async (onlyEmpty: boolean) => {
    setSuggesting(true);
    try {
      const s = await suggest({ studyId: study._id });
      setValue((v) => ({
        title: onlyEmpty && v.title.trim() ? v.title : s.title,
        audience: onlyEmpty && v.audience.trim() ? v.audience : s.audience,
        goal: onlyEmpty && v.goal.trim() ? v.goal : s.goal,
      }));
    } catch (err) {
      if (!onlyEmpty) toast.error(errorMessage(err, "Couldn't suggest details"));
    } finally {
      setSuggesting(false);
    }
  };

  // Prefill a blank study from its files once, so most people just confirm and continue.
  useEffect(() => {
    if (autoRan.current || !isBlank(study)) return;
    autoRan.current = true;
    void runSuggest(true);
  }, [study]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      className="max-w-xl space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await update({ studyId: study._id, title: value.title, audience: value.audience, goal: value.goal || undefined });
          onSaved();
        } catch (err) {
          toast.error(errorMessage(err, "Couldn't save details"));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {suggesting ? "Reading your files to suggest details…" : "Suggestions come from your files. Edit anything."}
        </p>
        <Button type="button" variant="secondary" className="h-10" disabled={suggesting} onClick={() => void runSuggest(false)}>
          {suggesting ? <Spinner /> : <Sparkles className="size-4" />} Suggest from my files
        </Button>
      </div>
      <DetailsFields value={value} onChange={setValue} disabled={suggesting} />
      <Button type="submit" size="lg" className="h-12 font-semibold" disabled={saving || suggesting || !value.title.trim() || !value.audience.trim()}>
        {saving && <Spinner />} Save and generate
      </Button>
    </form>
  );
}
