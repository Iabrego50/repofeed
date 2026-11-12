import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Copy, Layers, Loader2, Play, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api/complete";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { SHAREABLE_ORIGIN } from "@/lib/site.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import Logo from "@/components/logo.tsx";

const STEPS = ["About you", "Your workspace", "Your team", "First study"] as const;

const ROLES = ["UX researcher", "Designer", "Product manager", "Founder", "Something else"] as const;

function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  const given = user?.user_metadata?.name ?? user?.user_metadata?.full_name;
  return typeof given === "string" ? given : "";
}

/** "isaac@northwind.com" becomes "Northwind research". Personal mail domains get no suggestion. */
function suggestWorkspace(email: string | null | undefined): string {
  const domain = email?.split("@")[1]?.split(".")[0] ?? "";
  if (!domain || ["gmail", "outlook", "hotmail", "yahoo", "icloud", "proton", "protonmail", "me", "live", "aol"].includes(domain)) return "";
  return `${domain.charAt(0).toUpperCase()}${domain.slice(1)} research`;
}

function Rail({ step }: { step: number }) {
  return (
    <ol className="flex gap-2 lg:flex-col lg:gap-1">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === step ? "step" : undefined}
          className={cn("flex flex-1 items-center gap-3 rounded-md lg:flex-none lg:px-2 lg:py-2", i === step && "lg:bg-accent")}
        >
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
              i < step ? "bg-success text-white" : i === step ? "bg-foreground text-background" : "border border-border text-muted-foreground",
            )}
          >
            {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn("hidden text-sm lg:inline", i === step ? "font-semibold" : "text-muted-foreground")}>{label}</span>
          <span aria-hidden className={cn("h-0.5 flex-1 rounded lg:hidden", i < step ? "bg-success" : "bg-border")} />
        </li>
      ))}
    </ol>
  );
}

function Choice({ icon: Icon, title, body, onClick, primary }: { icon: typeof Upload; title: string; body: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-start gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        primary ? "border-foreground" : "border-border",
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", primary ? "bg-primary text-primary-foreground" : "bg-secondary")}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
      </span>
      <ArrowRight className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function StepShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Move focus to the new step's heading so keyboard and screen-reader users know the page changed.
  useEffect(() => heading.current?.focus(), []);
  return (
    <div>
      <h1 ref={heading} tabIndex={-1} className="text-balance text-2xl font-bold tracking-tight outline-none sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{lead}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

/**
 * First-run setup. Four short steps: who you are, name the workspace, bring in
 * the team (optional), then pick how to start. The workspace is created at step
 * two, so closing the tab after that still leaves a usable account.
 */
export default function WelcomePage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { refresh } = useWorkspace();
  const [step, setStep] = useState(0);
  // null means "not edited yet": show the suggestion derived from the account.
  const [nameInput, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [workspaceInput, setWorkspaceName] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ url: string; copied: boolean } | null>(null);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", "mine"],
    queryFn: () => api.workspaces.mine(),
    enabled: !!user && !isLoading,
  });

  // Someone who already has a workspace (an invited teammate, a returning user) skips setup.
  useEffect(() => {
    if (!isLoading && workspaces && workspaces.length > 0 && !workspaceId) navigate("/studies", { replace: true });
  }, [isLoading, workspaces, workspaceId, navigate]);

  useEffect(() => {
    if (!isLoading && !user) navigate("/", { replace: true });
  }, [isLoading, user, navigate]);

  const name = nameInput ?? displayName(user);
  const workspaceName = workspaceInput ?? suggestWorkspace(user?.email);

  if (isLoading || !user || (workspaces && workspaces.length > 0 && !workspaceId)) {
    return (
      <div className="flex min-h-full items-center justify-center py-24">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(1);
    // Not worth blocking setup on: the name can be changed later in settings.
    void api.users.update({ name: name.trim() }).catch(() => undefined);
  };

  const createWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || busy) return;
    if (workspaceId) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await api.workspaces.create({ name: workspaceName.trim() });
      setWorkspaceId(id);
      await refresh();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The workspace wasn’t created. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const makeInvite = async () => {
    if (!workspaceId || busy) return;
    setBusy(true);
    try {
      const { token } = await api.workspaces.createInvite({ workspaceId, role: "member" });
      const url = `${SHAREABLE_ORIGIN}/invite/${token}`;
      setInvite({ url, copied: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The invite link wasn’t created. You can make one later in Workspace settings.");
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setInvite({ ...invite, copied: true });
    } catch {
      toast.message("Select the link and copy it by hand.");
    }
  };

  const finish = async (first: "upload" | "demo" | "browse") => {
    track("onboarding_completed", { role: role || "not given", first, invited: Boolean(invite), workspaceId: workspaceId ?? undefined });
    void api.users.update({ onboardedAt: new Date().toISOString() }).catch(() => undefined);
    await refresh();
    navigate(first === "upload" ? "/studies/new" : first === "demo" ? "/demo" : "/studies", { replace: true });
  };

  const back = step > 0 && (
    <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} className="h-11">
      <ArrowLeft className="size-4" /> Back
    </Button>
  );

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto grid max-w-4xl gap-8 px-5 py-8 lg:grid-cols-[13rem_1fr] lg:gap-16 lg:py-16">
        <aside>
          <Logo />
          <div className="mt-6 lg:mt-10">
            <Rail step={step} />
          </div>
          <p className="mt-6 hidden text-sm text-muted-foreground lg:block">About two minutes. You can change all of this later.</p>
        </aside>

        <main className="max-w-lg" aria-live="polite">
          {step === 0 && (
            <StepShell key="you" title="Welcome. Who’s setting this up?" lead="Your name is what teammates see next to your comments and on studies you publish.">
              <form onSubmit={(e) => void saveProfile(e)} className="space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-name">Your name</Label>
                  <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} className="h-11 bg-card" placeholder="First and last name" />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">What do you do? <span className="font-normal text-muted-foreground">Optional</span></legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ROLES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={role === item}
                        onClick={() => setRole(role === item ? "" : item)}
                        className={cn(
                          "min-h-10 cursor-pointer rounded-full border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                          role === item ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground",
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" className="h-11 px-5 font-semibold" disabled={!name.trim()}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              </form>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell key="workspace" title="Name your workspace" lead="A workspace holds your studies and the people who watch them. Most teams name it after the company or the research team.">
              <form onSubmit={(e) => void createWorkspace(e)} className="space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-workspace">Workspace name</Label>
                  <Input
                    id="ob-workspace"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    required
                    maxLength={60}
                    disabled={busy || !!workspaceId}
                    aria-describedby={error ? "ob-workspace-error" : undefined}
                    aria-invalid={error ? true : undefined}
                    className="h-11 bg-card"
                    placeholder="Northwind research"
                  />
                  {workspaceId && <p className="text-sm text-muted-foreground">Created. Rename it any time in Workspace settings.</p>}
                  {error && <p id="ob-workspace-error" className="text-sm text-destructive">{error}</p>}
                </div>
                <div className="flex gap-2">
                  {back}
                  <Button type="submit" className="h-11 px-5 font-semibold" disabled={busy || !workspaceName.trim()}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> Creating</> : <>Continue <ArrowRight className="size-4" /></>}
                  </Button>
                </div>
              </form>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell key="team" title="Who should see your research?" lead="Teammates who join the workspace see every published study in their feed. Watching, reacting and commenting is free for as many people as you like.">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold">Invite teammates with a link</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Anyone who opens it signs in and joins as a viewer. The link works for seven days.</p>
                {invite ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <output className="min-w-0 flex-1 break-all rounded-md border border-border bg-background px-3 py-2 text-sm">{invite.url}</output>
                    <Button type="button" variant="outline" onClick={() => void copyInvite()} className="h-10 shrink-0">
                      {invite.copied ? <Check className="size-4" /> : <Copy className="size-4" />} {invite.copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => void makeInvite()} disabled={busy} className="mt-3 h-10">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create invite link
                  </Button>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Sharing with people outside the team, like a client or an exec? Each study also gets its own private link once you publish it. They type their name and start watching, with no account.
              </p>
              <div className="mt-6 flex gap-2">
                {back}
                <Button type="button" onClick={() => setStep(3)} className="h-11 px-5 font-semibold">
                  {invite ? "Continue" : "Skip for now"} <ArrowRight className="size-4" />
                </Button>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell key="first" title="How do you want to start?" lead="The quickest way to see what repofeed does is to give it a study you’ve already finished.">
              <div className="space-y-3">
                <Choice primary icon={Upload} title="Upload my own research" body="Drop in transcripts, survey exports or a deck. Your files stay on your computer; only the text is read." onClick={() => void finish("upload")} />
                <Choice icon={Play} title="Watch a sample study first" body="Scroll a finished demo feed to see what your team would get." onClick={() => void finish("demo")} />
                <Choice icon={Layers} title="Take me to my workspace" body="Look around and start a study when you’re ready." onClick={() => void finish("browse")} />
              </div>
              <div className="mt-6">{back}</div>
            </StepShell>
          )}
        </main>
      </div>
    </div>
  );
}
