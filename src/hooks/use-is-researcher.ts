import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/hooks/use-workspace.ts";
import { api } from "@/lib/api/complete";
import { isResearcherAccount } from "@/lib/researcher";

/**
 * Researchers = signed-in workspace owners/editors, or `users.is_admin`.
 * Used to gate Insights/deck/demo research CTAs on web.
 */
export function useIsResearcher(): { isResearcher: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const { current, isEditor, loading: workspaceLoading } = useWorkspace();
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => api.users.current(),
    enabled: !!user,
  });

  const isAdmin = Boolean((profile as { is_admin?: boolean } | null | undefined)?.is_admin);
  const loading = authLoading || (!!user && (workspaceLoading || profileLoading));

  return {
    loading,
    isResearcher: isResearcherAccount({
      signedIn: Boolean(user),
      workspaceRole: current?.role ?? (isEditor ? "editor" : "member"),
      isAdmin,
    }),
  };
}
