import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWorkspaces([]);
      setCurrent(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const userId = user.id;
    setLoading(true);

    async function loadWorkspaces() {
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

      if (cancelled) return;

      if (error) {
        console.error('Error loading workspaces:', error);
        setLoading(false);
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
      setCurrent((prev) => {
        if (prev && ws.some((workspace: Workspace) => workspace.id === prev.id)) return prev;
        return ws[0] ?? null;
      });
      setLoading(false);
    }

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

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
