import { Download, LogOut, PauseCircle, Play, Ship, Upload } from "lucide-react";
import { formatDateTime } from "../lib/format";
import type { BlBatch } from "../lib/types";

export type AppView = "dashboard" | "queue" | "admin";

interface HeaderProps {
  view: AppView;
  setView: (view: AppView) => void;
  latestBatch?: BlBatch;
  processing: boolean;
  canExport: boolean;
  onOpenUpload: () => void;
  onExport: () => void;
  onProcess: () => void;
  onCancel: () => void;
  onLogout: () => void;
}

export function Header({ view, setView, latestBatch, processing, canExport, onOpenUpload, onExport, onProcess, onCancel, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="container header-inner">
        <div className="brand">
          <div className="brand-mark"><Ship size={22} aria-hidden="true" /></div>
          <div>
            <h1>KPO BL Tracker</h1>
            <p>{latestBatch?.finishedAt ? `Ultima actualizacion: ${formatDateTime(latestBatch.finishedAt)}` : "Sistema interno de consulta BL"}</p>
          </div>
        </div>
        <div className="header-actions">
          <nav className="view-tabs" aria-label="Vistas principales">
            <button type="button" className={view === "dashboard" ? "active" : ""} aria-current={view === "dashboard" ? "page" : undefined} onClick={() => setView("dashboard")}>Dashboard</button>
            <button type="button" className={view === "queue" ? "active" : ""} aria-current={view === "queue" ? "page" : undefined} onClick={() => setView("queue")}>Cola</button>
            <button type="button" className={view === "admin" ? "active" : ""} aria-current={view === "admin" ? "page" : undefined} onClick={() => setView("admin")}>Admin</button>
          </nav>
          <button className="btn btn-white" type="button" onClick={onOpenUpload} aria-label="Cargar BL para busqueda masiva"><Upload size={16} aria-hidden="true" />Cargar BL</button>
          <button className="btn btn-ghost" type="button" disabled={processing} onClick={onProcess} aria-label="Procesar lote validado"><Play size={16} aria-hidden="true" />{processing ? "Procesando..." : "Procesar"}</button>
          {processing && <button className="btn btn-ghost" type="button" onClick={onCancel} aria-label="Cancelar procesamiento"><PauseCircle size={16} aria-hidden="true" />Cancelar</button>}
          <button className="btn btn-white" type="button" disabled={!canExport} onClick={onExport} aria-label="Exportar resultados a Excel"><Download size={16} aria-hidden="true" />Excel</button>
          <span className="badge info">admin</span>
          <button className="btn btn-ghost" type="button" onClick={onLogout} aria-label="Cerrar sesion"><LogOut size={16} aria-hidden="true" />Salir</button>
        </div>
      </div>
    </header>
  );
}
