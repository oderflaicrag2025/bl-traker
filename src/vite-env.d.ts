/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AUTH_MODE: "demo" | "supabase";
  readonly VITE_PROCESSING_PAUSE_MS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
