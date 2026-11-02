import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getBrowserSupabase } from './supabase';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  name?: string;
  email?: string;
  avatar?: string;
  loading: boolean;
  isLoading: boolean;
  signIn: (provider: 'google' | 'azure' | 'apple') => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  signout: () => Promise<void>; // Alias for compatibility
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const unavailableAuth = async () => {
  console.warn('[auth] Supabase is not configured');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const client = getBrowserSupabase();
    if (!client) {
      setLoading(false);
      return;
    }

    const applySession = (next: Session | null) => {
      if (cancelled) return;
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) {
        void loadProfile(next.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.warn('[auth] getSession', error.message);
        applySession(data.session ?? null);
      })
      .catch((error: unknown) => {
        console.warn('[auth] getSession failed', error);
        applySession(null);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId: string) {
    const client = getBrowserSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await client
        .from('users')
        .select('id, email, name, avatar')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile({
          id: data.id,
          email: data.email || '',
          name: data.name || undefined,
          avatar: data.avatar || undefined,
        });
      }
    } catch (error) {
      console.warn('[auth] loadProfile failed', error);
    } finally {
      setLoading(false);
    }
  }

  const signIn = async (provider: 'google' | 'azure' | 'apple') => {
    const client = getBrowserSupabase();
    if (!client) return unavailableAuth();
    const redirectTo = `${window.location.origin}/auth/callback`;
    await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  };

  const signInWithOtp = async (email: string) => {
    const client = getBrowserSupabase();
    if (!client) return unavailableAuth();
    const redirectTo = `${window.location.origin}/auth/callback`;
    await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
  };

  const signOut = async () => {
    const client = getBrowserSupabase();
    if (client) await client.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        name: profile?.name,
        email: profile?.email,
        avatar: profile?.avatar,
        loading,
        isLoading: loading,
        signIn,
        signInWithOtp,
        signOut,
        signout: signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
