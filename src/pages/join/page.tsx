import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { isNativePlatform } from "@/lib/native";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * Redeem a short team join code.
 * On native: after the product story, before division home.
 * `?switch=1` lets someone enter a different researcher's code.
 */
export default function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const switching = params.get("switch") === "1";
  const { refresh, setCurrent, workspaces, loading: workspacesLoading } = useWorkspace();
  const { nativeViewerMode, loading: adminLoading } = useNativeViewer();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const hasTeam = (workspaces?.length ?? 0) > 0;
  const nativeShell = isNativePlatform() || nativeViewerMode;

  // Native viewers who already belong to a team should not re-enter join codes unless switching.
  if (!workspacesLoading && !adminLoading && nativeViewerMode && hasTeam && !switching) {
    return <Navigate to={appHomePath()} replace />;
  }

  if (workspacesLoading || adminLoading) {
    return (
      <div className={cn("flex min-h-dvh items-center justify-center", nativeShell ? "bg-black" : "bg-background")}>
        <Spinner className={cn("size-6", nativeShell ? "text-white" : "text-primary")} />
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter the short code from your researcher");
      return;
    }
    setBusy(true);
    try {
      const workspaceId = await api.workspaces.redeemJoinCode({ code: trimmed });
      const list = await refresh();
      const joined = list.find((w) => w._id === workspaceId || w.id === workspaceId);
      if (joined) setCurrent(joined);
      toast.success("Connected to the research channel");
      navigate(appHomePath(), { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn’t join that team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center px-5 py-10",
        nativeShell ? "dark bg-black text-white" : "bg-background",
      )}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className={cn("mx-auto mb-4", nativeShell && "text-white")} />
          <h1 className="text-2xl font-bold tracking-tight">
            {switching ? "Enter a different code" : "Enter short code"}
          </h1>
          <p className={cn("mt-2 text-sm", nativeShell ? "text-white/60" : "text-muted-foreground")}>
            Ask your researcher for the code from Workspace settings on the web. You’ll connect as a viewer — no setup needed.
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className={cn(
            "space-y-4 rounded-2xl border p-5",
            nativeShell ? "border-white/15 bg-white/[0.06]" : "border-border bg-card",
          )}
        >
          <div className="space-y-2">
            <Label htmlFor="join-code" className={nativeShell ? "text-white/80" : undefined}>
              Short code
            </Label>
            <Input
              id="join-code"
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              placeholder="e.g. 7K3M9PQ2"
              className={cn(
                "h-12 text-center font-mono text-lg tracking-[0.2em] uppercase",
                nativeShell && "border-white/20 bg-black/40 text-white placeholder:text-white/35",
              )}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              disabled={busy}
            />
          </div>
          <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            {switching ? "Switch channel" : "Connect"}
          </Button>
        </form>

        {hasTeam ? (
          <p className={cn("text-center text-sm", nativeShell ? "text-white/50" : "text-muted-foreground")}>
            <Link to={appHomePath()} className={cn("font-medium underline-offset-4 hover:underline", nativeShell ? "text-white" : "text-foreground")}>
              Back to channels
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
