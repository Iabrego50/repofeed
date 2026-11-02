import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type BrowserSupabase = SupabaseClient<Database>;

function readEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  return String(import.meta.env[name] ?? '').trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'));
}

let client: BrowserSupabase | undefined;

/** Browser client, or null when env vars are missing so AuthProvider can still render. */
export function getBrowserSupabase(): BrowserSupabase | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient<Database>(readEnv('VITE_SUPABASE_URL'), readEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

function requireBrowserSupabase(): BrowserSupabase {
  const next = getBrowserSupabase();
  if (!next) {
    throw new Error('Missing Supabase environment variables');
  }
  return next;
}

/**
 * Lazy client so importing this module does not crash when env is unset.
 * First property access still requires config (API modules).
 */
export const supabase: BrowserSupabase = new Proxy({} as BrowserSupabase, {
  get(_target, prop) {
    const value = Reflect.get(requireBrowserSupabase(), prop);
    return typeof value === 'function' ? value.bind(requireBrowserSupabase()) : value;
  },
});

export type { Database };
