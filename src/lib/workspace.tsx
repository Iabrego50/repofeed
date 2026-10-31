import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Workspace {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'member';
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  switchWorkspace: (id: string) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    async function loadWorkspaces() {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          workspaces (
            id,
            name
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading workspaces:', error);
        setLoading(false);
        return;
      }

      const ws = data?.map((m: any) => ({
        id: m.workspace_id,
        name: m.workspaces.name,
        role: m.role,
      })) || [];

      setWorkspaces(ws);
      
      // Set first workspace as current if none selected
      if (ws.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(ws[0]);
      }
      
      setLoading(false);
    }

    loadWorkspaces();
  }, [user, authLoading]);

  const switchWorkspace = (id: string) => {
    const workspace = workspaces.find((w) => w.id === id);
    if (workspace) {
      setCurrentWorkspace(workspace);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        switchWorkspace,
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
