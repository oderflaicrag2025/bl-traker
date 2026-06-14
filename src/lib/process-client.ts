import { getSupabaseClient } from "./supabase-client";

export interface ProcessInvocationResult {
  ok: boolean;
  message: string;
}

/**
 * Pide al worker (Supabase Edge Function "process-bl-batch") que procese un lote.
 * El worker corre en backend con service_role: consulta Aduanas de forma secuencial
 * con pausas y escribe resultados/errores. El cliente NO scrapea ni escribe resultados.
 * El avance se refleja al recargar la lista (o, idealmente, via Supabase Realtime).
 */
export async function invokeProcessBatch(loteId: string): Promise<ProcessInvocationResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("process-bl-batch", { body: { loteId } });
  if (error) throw new Error(`No se pudo encolar el procesamiento: ${error.message}`);
  return { ok: true, message: (data as { message?: string } | null)?.message ?? "Lote enviado al worker." };
}
