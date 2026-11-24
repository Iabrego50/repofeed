import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
  authStorageKeyFromUrl,
  createAuthStorage,
  migrateNativeAuthStorage,
} from './auth-storage';

export type BrowserSupabase = SupabaseClient<Database>;

function readEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  return String(import.meta.env[name] ?? '').trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'));
}

let client: BrowserSupabase | undefined;
let ready: Promise<void> | undefined;

/**
 * Ensures native Preferences has any prior WebView localStorage session before
 * the first getSession/recover. No-op on web.
 */
export function ensureAuthStorageReady(): Promise<void> {
  if (!isSupabaseConfigured()) return Promise.resolve();
  if (!ready) {
    const url = readEnv('VITE_SUPABASE_URL');
    ready = migrateNativeAuthStorage(authStorageKeyFromUrl(url));
  }
  return ready;
}

/** Browser client, or null when env vars are missing so AuthProvider can still render. */
export function getBrowserSupabase(): BrowserSupabase | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    const url = readEnv('VITE_SUPABASE_URL');
    // Kick off native migration before callers hit getSession (AuthProvider awaits it).
    void ensureAuthStorageReady();
    client = createClient<Database>(url, readEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: createAuthStorage(),
        storageKey: authStorageKeyFromUrl(url),
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
