import { Ship } from "lucide-react";

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><Ship size={24} /></div>
          <h1>KPO BL Tracker</h1>
          <p>Acceso interno para usuarios autorizados.</p>
        </div>
        <div className="panel">
          <div className="panel-body grid">
            <label className="field"><span>Correo</span><input className="input" defaultValue="admin@kposervices.cl" /></label>
            <label className="field"><span>Contrasena</span><input className="input" type="password" placeholder="Demo: puedes entrar sin clave" /></label>
            <button className="btn btn-primary" onClick={onLogin}>Iniciar sesion</button>
            <div className="alert"><strong>Registro cerrado</strong><span>Las cuentas nuevas deben ser creadas por un administrador.</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}
