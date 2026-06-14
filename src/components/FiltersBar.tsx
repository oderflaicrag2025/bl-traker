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
    <div className="filters-compact" role="search" aria-label="Filtros de resultados">
      <div className="search">
        <Search size={15} aria-hidden="true" />
        <input className="input" value={filters.search} placeholder="Buscar BL, manifiesto, nave o puerto" aria-label="Buscar" onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
      </div>
      <select className="select" aria-label="Estado" value={filters.estado} onChange={(event) => setFilters({ ...filters, estado: event.target.value as DashboardFilters["estado"] })}>
        <option value="all">Estado: todos</option>
        <option value="exitoso">Exitosos</option>
        <option value="sin_resultado">Sin resultado</option>
        <option value="error_temporal">Error temporal</option>
        <option value="agotado_por_reintentos">Agotados</option>
        <option value="validado">Pendientes</option>
      </select>
      <select className="select" aria-label="Puerto" value={filters.puerto} onChange={(event) => setFilters({ ...filters, puerto: event.target.value })}>
        <option value="all">Puerto: todos</option>
        <option>San Antonio</option>
        <option>Valparaiso</option>
        <option>Ningbo</option>
      </select>
      <input className="input input-date" type="date" aria-label="Desde" title="Desde" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
      <input className="input input-date" type="date" aria-label="Hasta" title="Hasta" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
      <p className="metric-note">{filtered === total ? `${total} registros` : `${filtered} de ${total}`}</p>
    </div>
  );
}
