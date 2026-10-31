import { useAction } from '@/lib/convex-compat';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Plan } from "@/schema/validators.ts";

const planKey = (workspaceId: Id<"workspaces"> | undefined) => ["plan", workspaceId];

/** The workspace's plan, checked live with Hercules Commerce (never stored). */
export function usePlan(workspaceId: Id<"workspaces"> | undefined) {
  const getPlan = useAction(api.billing.actions.getPlan);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: planKey(workspaceId),
    enabled: workspaceId !== undefined,
    // Re-check when the user returns from the checkout tab.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async (): Promise<Plan> => {
      if (!workspaceId) return "free";
      return (await getPlan({ workspaceId })).plan;
    },
  });
  return {
    plan: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    refresh: () => client.invalidateQueries({ queryKey: planKey(workspaceId) }),
  };
}
