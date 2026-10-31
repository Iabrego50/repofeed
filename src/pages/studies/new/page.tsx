import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { ArrowRight, FileText, Sparkles, Wand2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { errorMessage } from "@/lib/errors.ts";
import PageHeader from "@/components/page-header.tsx";
import PermissionDenied from "@/components/permission-denied.tsx";

const FLOW = [
  { icon: FileText, title: "Add your files", body: "PDF, Word, PowerPoint, Excel, text, CSV or subtitle files, up to 25 MB each. You can also paste text." },
  { icon: Wand2, title: "Check the details", body: "The AI suggests a title and audience from your files." },
  { icon: Sparkles, title: "Generate scenes", body: "8–24 cited scenes, every quote checked." },
];

export default function NewStudyPage() {
  const { current, isEditor } = useWorkspace();
  const create = useAction(api.billing.actions.createStudy);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  if (!current) return null;
  if (!isEditor) return <PermissionDenied what="create studies" />;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:py-12">
      <PageHeader eyebrow="New study" title="Start with your research files" description="No forms first. Drop in your files and we'll fill in the rest." />
      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {FLOW.map((f, i) => (
          <li key={f.title} className="rounded-2xl border border-border bg-card p-4">
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <f.icon className="size-4 text-primary" /> Step {i + 1}
            </span>
            <p className="mt-2 font-medium">{f.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="mt-8 max-w-xl space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const id = await create({ workspaceId: current._id, title, audience: "" });
            navigate(`/studies/${id}?step=sources`);
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't create the study"));
            setSaving(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="study-title">Study title <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="study-title" className="h-12" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank and the AI will suggest one" />
        </div>
        <Button type="submit" size="lg" className="h-12 font-semibold" disabled={saving}>
          {saving ? <Spinner /> : <ArrowRight className="size-4" />} Add files
        </Button>
      </form>
    </div>
  );
}
