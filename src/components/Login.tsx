import { useState } from "react";
import { Ship } from "lucide-react";
import { isSupabaseMode } from "../lib/supabase-client";
import { signIn } from "../lib/auth";

export function Login({ onLogin }: { onLogin: () => void }) {
  const supabase = isSupabaseMode();
  const [email, setEmail] = useState(supabase ? "" : "admin@kposervices.cl");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (!supabase) return onLogin();
    if (!email.trim() || !password) return setError("Ingresa correo y contrasena.");
    setLoading(true);
    try {
      await signIn(email, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><Ship size={24} /></div>
          <h1>KPO BL Tracker</h1>
          <p>Acceso interno para usuarios autorizados.</p>
        </div>
        <div className="panel">
          <form className="panel-body grid" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label className="field"><span>Correo</span><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
            <label className="field"><span>Contrasena</span><input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder={supabase ? "Tu contrasena" : "Demo: puedes entrar sin clave"} /></label>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Ingresando..." : "Iniciar sesion"}</button>
            {error && <div className="alert" role="alert"><strong>No se pudo entrar</strong><span>{error}</span></div>}
            <div className="alert"><strong>Registro cerrado</strong><span>Las cuentas nuevas deben ser creadas por un administrador.</span></div>
          </form>
        </div>
      </div>
    </main>
  );
}
