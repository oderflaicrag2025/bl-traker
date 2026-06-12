import { Download, LogOut, PauseCircle, Play, Ship } from "lucide-react";
import { formatDateTime } from "../lib/format";
import type { BlBatch } from "../lib/types";

export type AppView = "dashboard" | "queue" | "admin";

interface HeaderProps {
  view: AppView;
  setView: (view: AppView) => void;
  latestBatch?: BlBatch;
  processing: boolean;
  canExport: boolean;
  onExport: () => void;
  onProcess: () => void;
  onCancel: () => void;
  onLogout: () => void;
}

export function Header({ view, setView, latestBatch, processing, canExport, onExport, onProcess, onCancel, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="container header-inner">
        <div className="brand">
          <div className="brand-mark"><Ship size={22} /></div>
          <div>
            <h1>KPO BL Tracker</h1>
            <p>{latestBatch?.finishedAt ? `Ultima actualizacion: ${formatDateTime(latestBatch.finishedAt)}` : "Sistema interno de consulta BL"}</p>
          </div>
        </div>
        <div className="header-actions">
          <nav className="view-tabs">
            <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button>
            <button className={view === "queue" ? "active" : ""} onClick={() => setView("queue")}>Cola</button>
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin</button>
          </nav>
          <button className="btn btn-ghost" disabled={processing} onClick={onProcess}><Play size={16} />{processing ? "Procesando..." : "Procesar"}</button>
          {processing && <button className="btn btn-ghost" onClick={onCancel}><PauseCircle size={16} />Cancelar</button>}
          <button className="btn btn-white" disabled={!canExport} onClick={onExport}><Download size={16} />Excel</button>
          <span className="badge info">admin</span>
          <button className="btn btn-ghost" onClick={onLogout}><LogOut size={16} />Salir</button>
        </div>
      </div>
    </header>
  );
}
