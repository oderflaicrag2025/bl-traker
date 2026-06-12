import { ShieldCheck } from "lucide-react";
import { demoUsers } from "../lib/demo-data";
import { formatDateTime } from "../lib/format";
import { statusLabel } from "../lib/status";
import type { BlItem } from "../lib/types";

export function AdminView({ logs }: { logs: BlItem[] }) {
  return (
    <div className="grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-title">Administracion demo</p>
            <p className="panel-subtitle">Pantalla preparada para conectar perfiles Supabase despues.</p>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th></tr></thead>
            <tbody>{demoUsers.map((user) => <tr key={user.id}><td>{user.email}</td><td>{user.nombre}</td><td><span className="badge info">{user.rol}</span></td><td>{user.activo ? "Si" : "No"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-title">Logs tecnicos demo</p>
            <p className="panel-subtitle">En produccion solo admin vera este bloque y los logs expiraran en 1 dia.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>BL</th><th>Estado</th><th>Status HTTP</th><th>Mensaje</th><th>Expira</th></tr></thead>
            <tbody>{logs.map((item) => <tr key={item.id}><td>{item.identificadorNormalizado}</td><td>{statusLabel(item.estado)}</td><td>{item.ultimoStatusHttp ?? "-"}</td><td>{item.error?.detalleTecnico ?? item.ultimoError}</td><td>{formatDateTime(item.error?.expiresAt)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
