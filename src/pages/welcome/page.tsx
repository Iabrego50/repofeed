import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from '@/lib/convex-compat';
import { toast } from "sonner";
import { Sparkles, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import Logo from "@/components/logo.tsx";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { errorMessage } from "@/lib/errors.ts";

export default function Welcome() {
  const create = useMutation(api.workspaces.create);
  const createDemo = useMutation(api.demo.createDemoWorkspace);
  const { setCurrent, workspaces } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"create" | "demo" | null>(null);

  const run = async (kind: "create" | "demo") => {
    setBusy(kind);
    try {
      const id = kind === "create" ? await create({ name }) : await createDemo({});
      setCurrent(id);
      toast.success(kind === "create" ? "Workspace created" : "Demo workspace ready");
      navigate(kind === "create" ? "/studies/new" : "/");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create the workspace. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-12">
      <Logo />
      <h1 className="mt-8 text-balance font-display text-4xl font-extrabold tracking-tight">
        {workspaces && workspaces.length > 0 ? "Create another workspace" : "Set up your workspace"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        A workspace holds your team's studies and feed. You'll be its owner and can invite people next.
      </p>
      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run("create");
        }}
      >
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Research"
          className="h-12"
          minLength={2}
          maxLength={60}
          required
        />
        <Button type="submit" size="lg" className="h-12 w-full font-semibold" disabled={busy !== null || name.trim().length < 2}>
          {busy === "create" ? <Spinner /> : <Users className="size-4" />}
          Create workspace
        </Button>
      </form>
      <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="secondary"
        size="lg"
        className="h-12 w-full"
        onClick={() => void run("demo")}
        disabled={busy !== null}
      >
        {busy === "demo" ? <Spinner /> : <Sparkles className="size-4 text-primary" />}
        Explore the demo study
      </Button>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Creates a "Demo" workspace with the published Supperly meal-kit study.
      </p>
    </div>
  );
}
