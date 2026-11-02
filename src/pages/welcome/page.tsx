import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import Logo from "@/components/logo.tsx";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces", "mine"],
    queryFn: () => api.workspaces.mine(),
    enabled: !!user && !isLoading,
  });

  useEffect(() => {
    if (!isLoading && workspaces) {
      if (workspaces.length > 0) {
        navigate("/studies");
      }
    }
  }, [isLoading, workspaces, navigate]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || creating) return;

    setCreating(true);
    try {
      const workspace = await api.workspaces.create({ name: workspaceName.trim() });
      navigate("/studies");
    } catch (error) {
      console.error("Failed to create workspace:", error);
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-4 size-12" />
          <h1 className="text-3xl font-bold">Welcome to RepoFeed</h1>
          <p className="mt-2 text-muted-foreground">Let's create your first workspace</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create workspace</CardTitle>
            <CardDescription>
              Your workspace is where you'll manage studies and collaborate with your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  placeholder="e.g., My Company"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating || !workspaceName.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create workspace
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
