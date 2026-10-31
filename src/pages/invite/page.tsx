import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import Logo from "@/components/logo.tsx";

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [accepting, setAccepting] = useState(false);

  const { data: invite, isLoading: isLoadingInvite, error } = useQuery({
    queryKey: ["invite", "peek", token],
    queryFn: () => api.workspaces.peekInvite({ token: token! }),
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: () => api.billing.actions.acceptInvite({ token: token! }),
    onSuccess: () => {
      toast.success("Joined workspace!");
      navigate("/studies");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to accept invite");
      setAccepting(false);
    },
  });

  useEffect(() => {
    if (!token) {
      navigate("/");
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate(`/?redirect=/invite?token=${token}`);
    }
  }, [isLoading, user, token, navigate]);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    acceptMutation.mutate();
  };

  if (!token || isLoading || isLoadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo className="mx-auto mb-4 size-12" />
            <h1 className="text-3xl font-bold">Invalid Invite</h1>
            <p className="mt-2 text-muted-foreground">
              This invite link is invalid or has expired.
            </p>
          </div>
          <Button onClick={() => navigate("/")} className="w-full">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-4 size-12" />
          <h1 className="text-3xl font-bold">You're Invited!</h1>
          <p className="mt-2 text-muted-foreground">
            Join the {invite.workspaceName} workspace
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Invite</CardTitle>
            <CardDescription>
              You've been invited to join <strong>{invite.workspaceName}</strong> as{" "}
              <strong>{invite.role === "editor" ? "an editor" : "a viewer"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleAccept} className="w-full" disabled={accepting}>
              {accepting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <Users className="size-4" />
                  Accept Invite
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
