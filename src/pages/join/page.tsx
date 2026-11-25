import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { isNativePlatform } from "@/lib/native";
import Logo from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * Redeem a short team join code.
 * On native: after the product story, before division home.
 * Yellow monospace digit boxes match design screen 07 / iOS style.
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
  const chars = Array.from({ length: 8 }, (_, i) => code[i] ?? "");

  if (!workspacesLoading && !adminLoading && nativeViewerMode && hasTeam && !switching) {
    return <Navigate to={appHomePath()} replace />;
  }

  if (workspacesLoading || adminLoading) {
    return (
      <div className={cn("flex min-h-dvh items-center justify-center", nativeShell ? "bg-studio" : "bg-background")}>
        <Spinner className={cn("size-6", nativeShell ? "text-white" : "text-primary")} />
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 6) {
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
        "flex min-h-dvh flex-col px-5 py-10",
        nativeShell ? "dark bg-studio text-white" : "bg-paper text-foreground",
      )}
    >
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
        <Logo className={nativeShell ? "text-white" : undefined} />
        {hasTeam ? (
          <Link
            to={appHomePath()}
            className={cn(
              "text-sm font-medium underline-offset-4 hover:underline",
              nativeShell ? "text-white/70" : "text-muted-foreground",
            )}
          >
            Back to channels
          </Link>
        ) : null}
      </header>

      <main className="mx-auto mt-12 w-full max-w-lg flex-1">
        <p className="font-mono text-[11px] tracking-[0.16em] text-eyebrow uppercase">
          {switching ? "Switch channel" : "Join the channel"}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {switching ? "Enter a different code" : "Enter the team join code"}
        </h1>
        <p className={cn("mt-2 text-sm", nativeShell ? "text-white/60" : "text-muted-foreground")}>
          Ask your researcher for the code from Workspace settings. You’ll land straight in their feed.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-6">
          <div
            className={cn(
              "rounded-[1.5rem] p-5 sm:p-6",
              nativeShell ? "bg-[#12162a]" : "bg-studio text-white shadow-lift",
            )}
          >
            <p className="font-mono text-[10px] tracking-[0.14em] text-eyebrow uppercase">Team join code</p>
            <label htmlFor="join-code" className="sr-only">
              Short code
            </label>
            <input
              id="join-code"
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={8}
              disabled={busy}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              className="sr-only"
              aria-label="Team join code"
            />
            <div
              className="mt-5 grid grid-cols-8 gap-1.5 sm:gap-2"
              onClick={() => document.getElementById("join-code")?.focus()}
            >
              {chars.map((ch, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border font-mono text-lg font-bold sm:text-xl",
                    nativeShell
                      ? "border-white/10 bg-[#0a0d16] text-mark"
                      : "border-white/10 bg-[#0a0d16] text-mark",
                    !ch && "text-white/15",
                  )}
                >
                  {ch || "·"}
                </span>
              ))}
            </div>
            <Button
              type="submit"
              className="mt-6 h-11 w-full font-semibold"
              disabled={busy || code.trim().length < 6}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {switching ? "Switch channel" : "Connect"}
            </Button>
          </div>

          <aside
            className={cn(
              "rounded-[1.5rem] border p-5",
              nativeShell ? "border-white/10 bg-white/[0.04]" : "border-border bg-card",
            )}
          >
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              How viewers join
            </p>
            <ol className="mt-3 space-y-2.5 text-sm">
              {[
                "Open the iOS app, or go to /join on the web",
                "Enter the code",
                "Start scrolling the research channel",
              ].map((line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                    {i + 1}
                  </span>
                  <span className={nativeShell ? "text-white/80" : "text-foreground"}>{line}</span>
                </li>
              ))}
            </ol>
          </aside>
        </form>
      </main>
    </div>
  );
}
