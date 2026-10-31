import { createContext, useContext } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { Role } from "@/convex/schema/validators.ts";

export type WorkspaceSummary = { _id: Id<"workspaces">; name: string; role: Role; seatPaused: boolean };

export type WorkspaceContextValue = {
  workspaces: WorkspaceSummary[] | undefined;
  current: WorkspaceSummary | null;
  setCurrent: (id: Id<"workspaces">) => void;
  isEditor: boolean;
  isOwner: boolean;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
