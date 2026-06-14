-- 002 - Politicas de escritura del cliente + automatizacion de auth.
-- Completa 001 (que solo definia SELECT/INSERT de lotes). Estrategia:
--   * Cliente (anon autenticado): crear lote + sus items, y actualizar estado del lote y de
--     sus items (cancelar / reintentar). Solo sobre lotes propios (o admin).
--   * Worker: escribe resultados_aduana, errores_consulta y logs_html_consulta con
--     service_role, que IGNORA RLS. Por eso aqui NO se agregan politicas de escritura
--     para esas tablas: deben permanecer sin acceso de escritura para el cliente anon.

-- 1) El dueno del lote se asigna automaticamente en la creacion (no se confia en el cliente).
create or replace function public.set_lote_creador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.creado_por is null then
    new.creado_por := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_lote_creador_before on public.lotes_consulta;
create trigger set_lote_creador_before
  before insert on public.lotes_consulta
  for each row execute function public.set_lote_creador();

-- 2) Crear perfil automaticamente cuando se registra un usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'usuario')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) El cliente puede actualizar SUS lotes (estado/totales/cancelacion).
drop policy if exists "usuarios actualizan sus lotes" on public.lotes_consulta;
create policy "usuarios actualizan sus lotes" on public.lotes_consulta
  for update
  using (creado_por = auth.uid() or public.is_admin())
  with check (creado_por = auth.uid() or public.is_admin());

-- 4) El cliente puede insertar/actualizar items de SUS lotes (crear lote, cancelar, reintentar).
drop policy if exists "usuarios crean items de sus lotes" on public.items_consulta;
create policy "usuarios crean items de sus lotes" on public.items_consulta
  for insert
  with check (exists (
    select 1 from public.lotes_consulta l
    where l.id = items_consulta.lote_id and (l.creado_por = auth.uid() or public.is_admin())
  ));

drop policy if exists "usuarios actualizan items de sus lotes" on public.items_consulta;
create policy "usuarios actualizan items de sus lotes" on public.items_consulta
  for update
  using (exists (
    select 1 from public.lotes_consulta l
    where l.id = items_consulta.lote_id and (l.creado_por = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.lotes_consulta l
    where l.id = items_consulta.lote_id and (l.creado_por = auth.uid() or public.is_admin())
  ));

-- Nota: resultados_aduana, errores_consulta y logs_html_consulta NO reciben politicas de
-- escritura a proposito. Las escribe el worker con service_role (bypassa RLS). El cliente
-- anon solo las lee (SELECT) segun las politicas definidas en 001.
