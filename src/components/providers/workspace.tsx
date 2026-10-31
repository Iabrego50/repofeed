import { useMemo, useState, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { WorkspaceContext, type WorkspaceContextValue } from "@/hooks/use-workspace.ts";

const KEY = "fieldreel.workspace";

/** Links in emails carry `?ws=` so they open in the workspace they're about. */
function initialWorkspace(): string | null {
  const fromLink = new URLSearchParams(window.location.search).get("ws");
  if (fromLink) localStorage.setItem(KEY, fromLink);
  return fromLink ?? localStorage.getItem(KEY);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const workspaces = useQuery(api.workspaces.listMine, isAuthenticated ? {} : "skip");
  const [selected, setSelected] = useState<string | null>(initialWorkspace);

  const value = useMemo<WorkspaceContextValue>(() => {
    const current = workspaces?.find((w) => w._id === selected) ?? workspaces?.[0] ?? null;
    return {
      workspaces,
      current,
      setCurrent: (id) => {
        localStorage.setItem(KEY, id);
        setSelected(id);
      },
      isEditor: current?.role === "editor" || current?.role === "owner",
      isOwner: current?.role === "owner",
    };
  }, [workspaces, selected]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
