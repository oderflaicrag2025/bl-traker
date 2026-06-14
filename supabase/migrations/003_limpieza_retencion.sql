-- 003 - Limpieza por retencion (errores y logs HTML expiran a 1 dia).
-- 001 define expires_at pero nada lo purga. Esta funcion borra lo vencido.
-- Se programa con pg_cron si esta disponible; si no, se invoca por Edge Function/cron externo.

create or replace function public.purgar_expirados()
returns table (errores_borrados bigint, logs_borrados bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_errores bigint;
  v_logs bigint;
begin
  delete from public.errores_consulta where expires_at < now();
  get diagnostics v_errores = row_count;
  delete from public.logs_html_consulta where expires_at < now();
  get diagnostics v_logs = row_count;
  return query select v_errores, v_logs;
end;
$$;

-- Programacion diaria con pg_cron (si la extension esta instalada en el proyecto).
-- En Supabase: Dashboard > Database > Extensions > habilitar "pg_cron".
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purgar-expirados-bl')
      where exists (select 1 from cron.job where jobname = 'purgar-expirados-bl');
    perform cron.schedule('purgar-expirados-bl', '0 4 * * *', $cmd$ select public.purgar_expirados(); $cmd$);
  else
    raise notice 'pg_cron no esta instalado: habilitalo y vuelve a correr este bloque, o invoca purgar_expirados() desde un cron externo / Edge Function.';
  end if;
end;
$$;
