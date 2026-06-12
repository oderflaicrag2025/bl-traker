export function formatDateTime(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago"
  }).format(parsed);
}

export function formatNumber(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value);
}

export function addDaysIso(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function todayBatchName(): string {
  return `Lote BL ${new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" }).format(new Date())}`;
}
