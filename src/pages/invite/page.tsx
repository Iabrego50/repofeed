// @ts-nocheck
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Authenticated, AuthLoading, Unauthenticated, useAction, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { Link2Off, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import Logo from "@/components/logo.tsx";
import { errorMessage } from "@/lib/errors.ts";

function JoinButton({ token }: { token: string }) {
  const accept = useAction(api.billing.actions.acceptInvite);
  const { setCurrent } = useWorkspace();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      className="h-12 w-full font-semibold"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const id = await accept({ token });
          setCurrent(id);
          toast.success("You've joined the workspace");
          navigate("/");
        } catch (err) {
          toast.error(errorMessage(err, "Couldn't join. Try again."));
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Users className="size-4" />} Join workspace
    </Button>
  );
}

export default function InvitePage() {
  const { token = "" } = useParams();
  const invite = useQuery(api.workspaces.peekInvite, { token });
  const { signin } = useAuth();
  const { setCurrent } = useWorkspace();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <Logo />
        {invite === undefined ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-6 h-12 w-full" />
          </div>
        ) : invite.status !== "valid" ? (
          <div className="mt-8">
            <Link2Off className="size-8 text-destructive" />
            <h1 className="mt-4 font-display text-2xl font-bold">
              {invite.status === "expired" ? "This invite has expired" : "This invite isn't valid"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Ask the person who sent it for a new link.
            </p>
            <Button variant="secondary" className="mt-6 h-11" onClick={() => navigate("/")}>
              Go to repofeed.ai
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">You're invited to</p>
            <h1 className="mt-2 break-words font-display text-3xl font-extrabold">{invite.workspaceName}</h1>
            <p className="mt-2 text-muted-foreground">
              as {invite.role === "editor" ? "an editor (create and publish studies)" : "a member (watch and discuss scenes)"}.
            </p>
            <div className="mt-8">
              <AuthLoading>
                <Skeleton className="h-12 w-full" />
              </AuthLoading>
              <Unauthenticated>
                <Button
                  size="lg"
                  className="h-12 w-full font-semibold"
                  onClick={() => void signin({ returnTo: `/invite/${token}` })}
                >
                  Sign in to join
                </Button>
              </Unauthenticated>
              <Authenticated>
                {invite.alreadyMember ? (
                  <Button
                    size="lg"
                    className="h-12 w-full"
                    onClick={() => {
                      setCurrent(invite.workspaceId);
                      navigate("/");
                    }}
                  >
                    You're already a member. Open feed
                  </Button>
                ) : (
                  <JoinButton token={token} />
                )}
              </Authenticated>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
