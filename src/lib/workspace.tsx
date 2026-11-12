import { useCallback, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

interface Workspace {
  _id: string; // Keep _id for compatibility
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'member';
  createdBy: string;
  customerId?: string;
  seatVariant?: string;
  seats?: number;
  paidPlan?: 'pro' | 'team';
  lapsedPlan?: 'pro' | 'team';
  seatOverage?: boolean;
  _creationTime: number; // Compatibility
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  current: Workspace | null;
  setCurrent: (workspace: Workspace | null) => void;
  isEditor: boolean;
  isOwner: boolean;
  loading: boolean;
  /** Reload the list, e.g. right after creating a workspace. Resolves once the new list is in place. */
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  // Which user the workspace list was last loaded for. Until it matches the signed-in user we are still loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          created_by,
          customer_id,
          seat_variant,
          seats,
          paid_plan,
          lapsed_plan,
          seat_overage,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error loading workspaces:', error);
      setLoadedFor(userId);
      return;
    }

    const ws = data?.map((m: any) => ({
      _id: m.workspace_id,
      id: m.workspace_id,
      name: m.workspaces.name,
      role: m.role,
      createdBy: m.workspaces.created_by,
      customerId: m.workspaces.customer_id,
      seatVariant: m.workspaces.seat_variant,
      seats: m.workspaces.seats,
      paidPlan: m.workspaces.paid_plan,
      lapsedPlan: m.workspaces.lapsed_plan,
      seatOverage: m.workspaces.seat_overage,
      _creationTime: new Date(m.workspaces.created_at).getTime(),
    })) || [];


    setWorkspaces(ws);
    // Keep the current selection if there is one; otherwise open the first workspace.
    setCurrent((existing) => existing ?? ws[0] ?? null);
    setLoadedFor(userId);
  }, []);

  useEffect(() => {
    // Reporting "no workspaces" before the first fetch lands bounced deep links
    // (e.g. /insights) through /welcome, so loading is derived below instead.
    if (authLoading || !user) return;
    void loadWorkspaces(user.id);
  }, [user, authLoading, loadWorkspaces]);

  const refresh = useCallback(async () => {
    if (user) await loadWorkspaces(user.id);
  }, [user, loadWorkspaces]);

  const loading = authLoading || (!!user && loadedFor !== user.id);
  const isEditor = current?.role === 'owner' || current?.role === 'editor';
  const isOwner = current?.role === 'owner';

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        current,
        setCurrent,
        isEditor,
        isOwner,
        loading,
        refresh,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
