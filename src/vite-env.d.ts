/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_ENABLE_GOOGLE_AUTH?: string;
  /** Exact "true" shows Continue with Apple (configure Apple provider in Supabase first). */
  readonly VITE_ENABLE_APPLE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
