import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types.js";

type ServerClient = SupabaseClient<Database>;

/** Service-role client for /api. Never use the browser client or import.meta.env. */
export function supabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}

export function serviceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function createServerSupabase(): ServerClient {
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let cached: ServerClient | undefined;

export function getServerSupabase(): ServerClient {
  if (!cached) cached = createServerSupabase();
  return cached;
}

export const supabase: ServerClient = new Proxy({} as ServerClient, {
  get(_target, prop, _receiver) {
    const client = getServerSupabase();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
