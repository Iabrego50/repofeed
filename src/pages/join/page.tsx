import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { appHomePath } from "@/lib/native-access.ts";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

/**
 * Redeem a short team join code.
 * On native viewers, only when they have no team yet — researchers share codes from desktop.
 */
export default function JoinPage() {
  const navigate = useNavigate();
  const { refresh, setCurrent, workspaces, loading: workspacesLoading } = useWorkspace();
  const { nativeViewerMode, loading: adminLoading } = useNativeViewer();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const hasTeam = (workspaces?.length ?? 0) > 0;

  // Native viewers who already belong to a team should not re-enter join codes here.
  if (!workspacesLoading && !adminLoading && nativeViewerMode && hasTeam) {
    return <Navigate to={appHomePath()} replace />;
  }

  if (workspacesLoading || adminLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter the team join code you were sent");
      return;
    }
    setBusy(true);
    try {
      const workspaceId = await api.workspaces.redeemJoinCode({ code: trimmed });
      const list = await refresh();
      const joined = list.find((w) => w._id === workspaceId || w.id === workspaceId);
      if (joined) setCurrent(joined);
      toast.success("You’re on the team");
      navigate(appHomePath(), { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn’t join that team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Enter team code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask a researcher for the short code from Workspace settings on the web. You’ll join as a viewer.
          </p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="join-code">Join code</Label>
            <Input
              id="join-code"
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              placeholder="e.g. 7K3M9PQ2"
              className="h-12 text-center font-mono text-lg tracking-[0.2em] uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              disabled={busy}
            />
          </div>
          <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Join team
          </Button>
        </form>

        {hasTeam ? (
          <p className="text-center text-sm text-muted-foreground">
            <Link to={appHomePath()} className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to Explore
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
