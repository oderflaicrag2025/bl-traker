import { Search } from "lucide-react";
import type { DashboardFilters } from "../lib/types";

interface FiltersBarProps {
  filters: DashboardFilters;
  setFilters: (filters: DashboardFilters) => void;
  total: number;
  filtered: number;
}

export function FiltersBar({ filters, setFilters, total, filtered }: FiltersBarProps) {
  return (
    <div className="panel filters">
      <label className="field">
        <span>Buscar BL, manifiesto, nave o puerto</span>
        <div className="search">
          <Search size={16} />
          <input className="input" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </div>
      </label>
      <label className="field">
        <span>Estado</span>
        <select className="select" value={filters.estado} onChange={(event) => setFilters({ ...filters, estado: event.target.value as DashboardFilters["estado"] })}>
          <option value="all">Todos</option>
          <option value="exitoso">Exitosos</option>
          <option value="sin_resultado">Sin resultado</option>
          <option value="error_temporal">Error temporal</option>
          <option value="agotado_por_reintentos">Agotados</option>
          <option value="validado">Pendientes</option>
        </select>
      </label>
      <label className="field">
        <span>Puerto</span>
        <select className="select" value={filters.puerto} onChange={(event) => setFilters({ ...filters, puerto: event.target.value })}>
          <option value="all">Todos</option>
          <option>San Antonio</option>
          <option>Valparaiso</option>
          <option>Ningbo</option>
        </select>
      </label>
      <label className="field"><span>Desde</span><input className="input" type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
      <label className="field"><span>Hasta</span><input className="input" type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
      <p className="metric-note">{filtered === total ? `${total} registros` : `${filtered} de ${total} registros`}</p>
    </div>
  );
}
