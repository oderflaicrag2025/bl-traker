// Worker de referencia para Supabase Edge Functions o migracion a Railway.
// No evade captcha, 403, geolocalizacion, autenticacion ni reglas de acceso.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ADUANAS_URL = "https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp?Action=Event";

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase service credentials are missing" }, 500);
  const { loteId } = await request.json();
  if (!loteId) return json({ error: "loteId is required" }, 400);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase.from("lotes_consulta").update({ estado: "en_cola" }).eq("id", loteId);
  return json({ ok: true, message: "Lote recibido. El procesamiento real debe ejecutarse secuencialmente con pausas controladas.", loteId, source: ADUANAS_URL });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
