import { getSupabaseClient } from "./supabase-client";

export interface SessionInfo {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  nombre: string | null;
}

/** Inicia sesion con email/clave (Supabase Auth) y resuelve el perfil/rol. */
export async function signIn(email: string, password: string): Promise<SessionInfo> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(traducirAuthError(error.message));
  if (!data.user) throw new Error("No se pudo iniciar sesion.");
  return resolveProfile(data.user.id, data.user.email ?? null);
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

/** Devuelve la sesion actual si existe (para rehidratar al cargar la app). */
export async function getCurrentSession(): Promise<SessionInfo | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return resolveProfile(user.id, user.email ?? null);
}

async function resolveProfile(userId: string, email: string | null): Promise<SessionInfo> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("rol, nombre, activo")
    .eq("id", userId)
    .maybeSingle();
  if (data && data.activo === false) {
    await supabase.auth.signOut();
    throw new Error("La cuenta esta desactivada. Contacta a un administrador.");
  }
  return { userId, email, isAdmin: data?.rol === "admin", nombre: data?.nombre ?? null };
}

function traducirAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(message)) return "El correo aun no esta confirmado.";
  return message;
}
