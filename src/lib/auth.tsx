import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Browser } from '@capacitor/browser';
import { ensureAuthStorageReady, getBrowserSupabase } from './supabase';
import { FEED_PATH } from '@/app-paths.ts';
import { resolveReturnTo } from '@/pages/auth/return-to.ts';
import { completeSignup } from './analytics';
import { authRedirectOrigin, isNativePlatform } from './native';

function authCallbackUrl(): string {
  const origin = authRedirectOrigin().replace(/\/$/, '');
  const returnTo = resolveReturnTo({
    returnTo: new URLSearchParams(window.location.search).get('returnTo'),
  });
  if (returnTo === FEED_PATH) return `${origin}/auth/callback`;
  return `${origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
}

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
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
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
  // Start loading only when a client exists; missing env must not flash a spinner forever.
  const [loading, setLoading] = useState(() => Boolean(getBrowserSupabase()));
  // Until the first getSession() finishes, ignore auth events that would
  // flip loading=false with a null user and bounce Gate to /signin.
  const hydratedRef = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
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
  }, []);

  const applySession = useCallback(
    (next: Session | null) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) {
        void loadProfile(next.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    let cancelled = false;
    const client = getBrowserSupabase();
    if (!client) return;

    const hydrate = async () => {
      try {
        await ensureAuthStorageReady();
        const { data, error } = await client.auth.getSession();
        if (cancelled) return;
        if (error) console.warn('[auth] getSession', error.message);
        hydratedRef.current = true;
        applySession(data.session ?? null);
      } catch (error: unknown) {
        if (cancelled) return;
        console.warn('[auth] getSession failed', error);
        hydratedRef.current = true;
        applySession(null);
      }
    };

    void hydrate();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      // INITIAL_SESSION races with getSession(); hydration owns the first paint.
      if (event === 'INITIAL_SESSION') return;
      if (!hydratedRef.current) return;
      applySession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (provider: 'google' | 'azure' | 'apple') => {
    const client = getBrowserSupabase();
    if (!client) return unavailableAuth();
    const native = isNativePlatform();
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authCallbackUrl(),
        // System browser + appUrlOpen completes the PKCE exchange on iOS.
        skipBrowserRedirect: native,
      },
    });
    if (error) throw error;
    if (native && data?.url) {
      await Browser.open({ url: data.url, presentationStyle: 'popover' });
    }
  };

  const signInWithOtp = async (email: string) => {
    const client = getBrowserSupabase();
    if (!client) return unavailableAuth();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    });
    // Surface failures (rate limits, bad address) instead of telling people to check an inbox that will stay empty.
    if (error) throw error;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const client = getBrowserSupabase();
    if (!client) return unavailableAuth();
    const { data, error } = await client.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    // Apply before the sign-in page navigates so Gate/GuestOnly see the user
    // in the same tick (onAuthStateChange alone can lag one frame).
    hydratedRef.current = true;
    applySession(data.session ?? null);
    if (data.session?.user) {
      try {
        await completeSignup({ client, user: data.session.user });
      } catch (upsertError) {
        console.error('Failed to create user:', upsertError);
      }
    }
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
        verifyEmailOtp,
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
