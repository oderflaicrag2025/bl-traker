// ESPEJO de src/lib/aduanas-parser.ts adaptado para Deno (Edge Function).
// Es codigo puro (regex/strings) sin dependencias. Si cambias uno, sincroniza el otro.
// No evade captcha, 403, geolocalizacion ni autenticacion: solo parsea HTML ya recibido.

export type ParseOutcome = {
  status: "success" | "no_result" | "forbidden" | "parser_error";
  result?: Record<string, string | number | Record<string, string> | undefined>;
  message?: string;
};

const labelMap: Record<string, string> = {
  "nro. manifiesto": "nroManifesto",
  "nro manifiesto": "nroManifesto",
  nave: "nave",
  sentido: "sentido",
  "fecha arribo/zarpe estimado": "fechaArriboZarpeEstimado",
  "cia naviera": "ciaNaviera",
  "fecha emision manifiesto": "fechaEmisionManifiesto",
  "nro bl": "nroBl",
  emisor: "emisor",
  "fecha de emision": "fechaEmisionBl",
  "fecha de aceptacion": "fechaAceptacion",
  "fecha de embarque": "fechaEmbarque",
  almacen: "almacen",
  "puerto embarque": "puertoEmbarque",
  "puerto desembarque": "puertoDesembarque",
  "ultimo transbordo": "ultimoTransbordo",
  "total peso": "totalPeso"
};

function normalizeLabel(label: string): string {
  return label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").replace(/\s*:\s*$/, "").trim();
}

function cleanupHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/veepn-lock-screen[\s\S]*?(?=<\/body>|$)/gi, " ");
}

function textFromHtml(html: string): string {
  return cleanupHtml(html).replace(/<\/(td|th|tr|p|div|br|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

function cellTexts(row: string): string[] {
  return (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((cell) => cell.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function readFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const text = textFromHtml(html);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const [rawLabel, ...inlineValue] = lines[i].split(":");
    const label = normalizeLabel(rawLabel);
    if (!labelMap[label]) continue;
    const value = inlineValue.join(":").trim() || lines[i + 1]?.trim();
    if (value && !labelMap[normalizeLabel(value)]) fields[label] = value;
  }
  for (const table of cleanupHtml(html).match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rows) {
      const cells = cellTexts(row);
      if (cells.length >= 2 && labelMap[normalizeLabel(cells[0])]) fields[normalizeLabel(cells[0])] = cells[1];
    }
    for (let i = 0; i < rows.length - 1; i += 1) {
      const headers = cellTexts(rows[i]);
      const values = cellTexts(rows[i + 1]);
      if (!headers.some((h) => normalizeLabel(h) === "nro bl")) continue;
      headers.forEach((header, index) => { if (values[index]) fields[normalizeLabel(header)] = values[index]; });
    }
  }
  return fields;
}

export function parseAduanasMaritimeHtml(html: string, statusHttp = 200): ParseOutcome {
  if (statusHttp === 403 || /403\s+forbidden/i.test(html)) return { status: "forbidden", message: "Aduanas rechazo la solicitud con 403 Forbidden." };
  const rawFields = readFields(html);
  const result: Record<string, string | number | Record<string, string> | undefined> = { rawFields };
  for (const [label, value] of Object.entries(rawFields)) {
    const key = labelMap[normalizeLabel(label)];
    result[key] = key === "totalPeso" ? Number.parseFloat(value.replace(/\./g, "").replace(",", ".")) : value;
  }
  if (result.nroManifesto || result.nave || result.nroBl) return { status: "success", result };
  if (/sin datos|sin resultado|no se encontraron|no existen consultas/i.test(textFromHtml(html))) return { status: "no_result", message: "La respuesta no contiene resultados visibles para el BL." };
  return { status: "no_result", message: "No se detectaron campos de manifiesto o BL en la respuesta." };
}

export function extractPageCode(html: string): string | null {
  return html.match(/name=["']CON_ConsultaGralMFTOpageCode["'][^>]*value=["']([^"']+)["']/i)?.[1] ?? null;
}

/** Extrae el header Set-Cookie y lo reduce a "k=v; k2=v2" para reutilizar la sesion. */
export function collectCookies(headers: Headers): string {
  const jar: Record<string, string> = {};
  // Deno expone getSetCookie() en versiones recientes; fallback a get("set-cookie").
  const raw: string[] = typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
    ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
    : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  for (const line of raw) {
    const pair = line.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}
