// Convex compatibility layer - provides drop-in replacement for convex/react
import { useQuery as useReactQuery, useMutation as useReactMutation, type QueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// API function type
type ApiFunction = (...args: any[]) => Promise<any>;

// Convex-like useQuery hook
export function useQuery<T>(
  fn: ApiFunction,
  args: any
): T | undefined {
  const skip = args === 'skip';
  
  const result = useReactQuery({
    queryKey: [fn.name, args],
    queryFn: () => fn(args),
    enabled: !skip,
    staleTime: 1000,
  });

  return result.data as T | undefined;
}

// Convex-like useMutation hook
export function useMutation<T extends ApiFunction>(fn: T) {
  const mutation = useReactMutation({
    mutationFn: (args: Parameters<T>[0]) => fn(args),
  });

  return async (args: Parameters<T>[0]) => {
    const result = await mutation.mutateAsync(args);
    return result;
  };
}

// Convex-like useAction hook (same as useMutation for our purposes)
export function useAction<T extends ApiFunction>(fn: T) {
  return useMutation(fn);
}

// Auth components
export function Authenticated({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return null;
  return <>{children}</>;
}

export function Unauthenticated({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return null;
  return <>{children}</>;
}

export function AuthLoading({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (!loading) return null;
  return <>{children}</>;
}

// Convex auth hook
export function useConvexAuth() {
  const { user, loading } = useAuth();
  return {
    isAuthenticated: !!user,
    isLoading: loading,
  };
}

// useConvex hook (not needed in our implementation)
export function useConvex() {
  return {
    query: () => {},
    mutation: () => {},
  };
}
