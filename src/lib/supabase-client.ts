import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase para el FRONTEND (clave anon, solo lectura + crear/cancelar lote
// segun RLS). La escritura del procesamiento (resultados/errores/logs) la hace el
// worker con service_role, NO este cliente. Ver docs/CONEXIONES-PENDIENTES.md.

let client: SupabaseClient | null = null;

export function isSupabaseMode(): boolean {
  return import.meta.env.VITE_AUTH_MODE === "supabase";
}

/** Devuelve el cliente Supabase (singleton). Lanza si faltan las variables de entorno. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Configura el .env para usar VITE_AUTH_MODE=supabase."
    );
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}
