import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/complete";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { useNativeViewer } from "@/hooks/use-native-viewer.ts";
import { appHomePath } from "@/lib/native-access.ts";
import { isNativePlatform } from "@/lib/native";
import SlopShell, { SlopBrand, SlopPill } from "@/components/slop/slop-shell.tsx";
import Logo from "@/components/logo.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * Redeem a short team join code.
 * On native: after the product story, before division home.
 * Web uses a lighter SlopShell restyle.
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
      <div className={cn("flex min-h-dvh items-center justify-center", nativeShell ? "bg-studio" : "slop-scope")}>
        <Spinner className={cn("size-6", nativeShell ? "text-white" : "text-purple-300")} />
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

  if (nativeShell) {
    return (
      <div className="dark flex min-h-dvh flex-col bg-studio px-5 py-10 text-white">
        <header className="mx-auto flex w-full max-w-lg items-center justify-between">
          <Logo className="text-white" />
          {hasTeam ? (
            <Link to={appHomePath()} className="text-sm font-medium text-white/70 underline-offset-4 hover:underline">
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
          <p className="mt-2 text-sm text-white/60">
            Ask your researcher for the code from Workspace settings. You’ll land straight in their feed.
          </p>
          <JoinForm
            code={code}
            setCode={setCode}
            chars={chars}
            busy={busy}
            switching={switching}
            onSubmit={onSubmit}
            dark
          />
        </main>
      </div>
    );
  }

  return (
    <SlopShell>
      <header className="slop-navbar relative z-20">
        <div className="slop-navbar-inner flex-wrap px-6 py-2">
          <Link to="/" aria-label="repofeed.ai home">
            <SlopBrand />
          </Link>
          {hasTeam ? (
            <Link to={appHomePath()} className="slop-btn slop-btn-ghost" style={{ minHeight: 44 }}>
              Back to channels
            </Link>
          ) : null}
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-6 pb-12 pt-10">
        <div className="rf-rise flex flex-col items-start gap-4">
          <SlopPill dot="cyan">{switching ? "Switch channel" : "Join the channel"}</SlopPill>
          <h1 className="slop-h1 m-0 text-balance" style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)" }}>
            {switching ? (
              <>
                Enter a <span className="slop-serif-emphasis slop-text-gradient-hot">different</span> code
              </>
            ) : (
              <>
                Enter the team <span className="slop-serif-emphasis slop-text-gradient-hot">join code</span>
              </>
            )}
          </h1>
          <p className="slop-lead m-0 max-w-[44ch]">
            Ask your researcher for the code from Workspace settings. You’ll land straight in their feed.
          </p>
          <JoinForm
            code={code}
            setCode={setCode}
            chars={chars}
            busy={busy}
            switching={switching}
            onSubmit={onSubmit}
          />
        </div>
      </main>
    </SlopShell>
  );
}

function JoinForm({
  code,
  setCode,
  chars,
  busy,
  switching,
  onSubmit,
  dark,
}: {
  code: string;
  setCode: (v: string) => void;
  chars: string[];
  busy: boolean;
  switching: boolean;
  onSubmit: (e: FormEvent) => void;
  dark?: boolean;
}) {
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-4 w-full space-y-6">
      <div className={cn(dark ? "rounded-[1.5rem] bg-[#12162a] p-5 sm:p-6" : "slop-card slop-card-beam p-6")}>
        <p
          className="m-0 font-mono text-[10px] tracking-[0.14em] uppercase"
          style={{ color: dark ? undefined : "#94a3b8" }}
        >
          Team join code
        </p>
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
                !ch && "opacity-40",
              )}
              style={{
                borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(192, 132, 252, .35)",
                background: dark ? "#0a0d16" : "rgba(2, 6, 23, .7)",
              }}
            >
              {dark ? (
                <span className="text-mark">{ch || "·"}</span>
              ) : (
                <span className="slop-text-gradient">{ch || "·"}</span>
              )}
            </span>
          ))}
        </div>
        {dark ? (
          <button
            type="submit"
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            disabled={busy || code.trim().length < 6}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {switching ? "Switch channel" : "Connect"}
          </button>
        ) : (
          <button
            type="submit"
            className="slop-btn slop-btn-primary slop-btn-lg mt-6 w-full"
            disabled={busy || code.trim().length < 6}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {switching ? "Switch channel" : "Connect"}
          </button>
        )}
      </div>

      <aside className={cn(dark ? "rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5" : "slop-card slop-border-l-cyan p-5")}>
        <p
          className="m-0 font-mono text-[10px] tracking-[0.14em] uppercase"
          style={{ color: "#94a3b8" }}
        >
          How viewers join
        </p>
        <ol className="mt-3 space-y-2.5 text-sm">
          {[
            "Open the iOS app, or go to /join on the web",
            "Enter the code",
            "Start scrolling the research channel",
          ].map((line, i) => (
            <li key={line} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  dark && "bg-foreground text-background",
                )}
                style={
                  dark
                    ? undefined
                    : { background: "linear-gradient(135deg, #4338ca, #7e22ce)", color: "#fff" }
                }
              >
                {i + 1}
              </span>
              <span className={dark ? "text-white/80" : undefined}>{line}</span>
            </li>
          ))}
        </ol>
      </aside>
    </form>
  );
}
