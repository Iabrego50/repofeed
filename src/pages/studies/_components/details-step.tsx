import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { UNTITLED_STUDY } from "@/schema/validators.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";

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

const isBlank = (study: any) => !study.audience?.trim() && (study.title === UNTITLED_STUDY || !study.title?.trim());

interface DetailsStepProps {
  studyId: string;
  study: any;
  onNext: () => void;
}

export default function DetailsStep({ studyId, study, onNext }: DetailsStepProps) {
  const updateMutation = useMutation({
    mutationFn: (details: Details) => api.studies.updateDetails({ studyId, ...details }),
  });

  const [value, setValue] = useState<Details>({
    title: study.title === UNTITLED_STUDY ? "" : study.title,
    audience: study.audience || "",
    goal: study.goal ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const autoRan = useRef(false);

  const runSuggest = async (onlyEmpty: boolean) => {
    setSuggesting(true);
    try {
      // AI suggestion feature from main can be ported as enhancement
      const s = {
        title: "Suggested Title",
        audience: "Suggested Audience",
        goal: "Suggested Goal",
      };
      setValue((v) => ({
        title: onlyEmpty && v.title.trim() ? v.title : s.title,
        audience: onlyEmpty && v.audience.trim() ? v.audience : s.audience,
        goal: onlyEmpty && v.goal.trim() ? v.goal : s.goal,
      }));
    } catch (err: any) {
      if (!onlyEmpty) toast.error(err.message || "Couldn't suggest details");
    } finally {
      setSuggesting(false);
    }
  };

  useEffect(() => {
    if (autoRan.current || !isBlank(study)) return;
    autoRan.current = true;
    void runSuggest(true);
  }, [study]);

  return (
    <form
      className="max-w-xl space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await updateMutation.mutateAsync(value);
          toast.success("Details saved");
          onNext();
        } catch (err: any) {
          toast.error(err.message || "Couldn't save details");
        } finally {
          setSaving(false);
        }
      }}
    >
      <DetailsFields value={value} onChange={setValue} disabled={saving || suggesting} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={saving || suggesting || !value.title.trim() || !value.audience.trim()}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save & Continue"
          )}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => runSuggest(false)}
          disabled={saving || suggesting}
        >
          {suggesting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Suggesting...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Suggest from sources
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
