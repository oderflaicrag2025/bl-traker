create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'usuario');
create type fuente_estado as enum ('activa', 'en_revision', 'inactiva');
create type lote_estado as enum ('borrador', 'validado', 'en_cola', 'procesando', 'completado', 'completado_con_errores', 'cancelado', 'fallido');
create type item_estado as enum ('pendiente', 'validado', 'omitido_duplicado', 'en_proceso', 'exitoso', 'sin_resultado', 'error_temporal', 'error_permanente', 'agotado_por_reintentos', 'cancelado');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text not null, nombre text, rol user_role not null default 'usuario', activo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.fuentes_consulta (id uuid primary key default gen_random_uuid(), tipo_consulta text not null default 'BL_MARITIMO', nombre text not null, url_base text not null, metodo text not null default 'POST', estado fuente_estado not null default 'activa', requiere_manifesto boolean not null default false, requiere_identificador boolean not null default true, notas text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.lotes_consulta (id uuid primary key default gen_random_uuid(), nombre_lote text not null, tipo_consulta text not null default 'BL_MARITIMO', fuente_id uuid references public.fuentes_consulta(id), archivo_nombre text, estado lote_estado not null default 'borrador', total_items integer not null default 0, total_exitosos integer not null default 0, total_sin_resultado integer not null default 0, total_fallidos integer not null default 0, total_reintentos integer not null default 0, creado_por uuid references auth.users(id), created_at timestamptz not null default now(), validated_at timestamptz, started_at timestamptz, finished_at timestamptz, cancel_requested_at timestamptz);
create table public.items_consulta (id uuid primary key default gen_random_uuid(), lote_id uuid not null references public.lotes_consulta(id) on delete cascade, posicion_archivo integer not null, tipo_consulta text not null default 'BL_MARITIMO', identificador_original text not null, identificador_normalizado text not null, nro_manifesto text, estado item_estado not null default 'pendiente', intento_actual integer not null default 0, max_intentos integer not null default 10, ultimo_error text, ultimo_status_http integer, resultado_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz);
create table public.resultados_aduana (id uuid primary key default gen_random_uuid(), tipo_consulta text not null default 'BL_MARITIMO', identificador_normalizado text not null, nro_bl text, nro_manifesto text, nave text, sentido text, fecha_arribo_zarpe_estimado text, cia_naviera text, fecha_emision_manifiesto text, emisor text, fecha_emision_bl text, fecha_aceptacion text, fecha_embarque text, almacen text, puerto_embarque text, puerto_desembarque text, ultimo_transbordo text, total_peso numeric, fuente_id uuid references public.fuentes_consulta(id), ultimo_item_id uuid references public.items_consulta(id), campos_extraidos_json jsonb not null default '{}', consulted_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tipo_consulta, identificador_normalizado));
alter table public.items_consulta add constraint items_resultado_fk foreign key (resultado_id) references public.resultados_aduana(id);
create table public.errores_consulta (id uuid primary key default gen_random_uuid(), item_id uuid not null references public.items_consulta(id) on delete cascade, lote_id uuid not null references public.lotes_consulta(id) on delete cascade, tipo_error text not null, mensaje_usuario text not null, detalle_tecnico text, status_http integer, intento integer not null, reintentable boolean not null default true, created_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '1 day'));
create table public.logs_html_consulta (id uuid primary key default gen_random_uuid(), item_id uuid references public.items_consulta(id) on delete cascade, lote_id uuid references public.lotes_consulta(id) on delete cascade, status_http integer, url_final text, metodo text, form_data_resumen jsonb not null default '{}', request_headers_resumen jsonb not null default '{}', response_headers_resumen jsonb not null default '{}', html_respuesta text, hash_html text, created_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '1 day'), visible_solo_admin boolean not null default true);

create index idx_items_lote on public.items_consulta(lote_id);
create index idx_items_identificador on public.items_consulta(identificador_normalizado);
create index idx_resultados_identificador on public.resultados_aduana(tipo_consulta, identificador_normalizado);
create index idx_errores_created_at on public.errores_consulta(created_at);
create index idx_logs_expires_at on public.logs_html_consulta(expires_at);
create index idx_lotes_creador_fecha on public.lotes_consulta(creado_por, created_at desc);

alter table public.profiles enable row level security;
alter table public.fuentes_consulta enable row level security;
alter table public.lotes_consulta enable row level security;
alter table public.items_consulta enable row level security;
alter table public.resultados_aduana enable row level security;
alter table public.errores_consulta enable row level security;
alter table public.logs_html_consulta enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin' and activo = true); $$;

create policy "usuarios leen profiles" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "admin administra profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "usuarios leen fuentes" on public.fuentes_consulta for select using (auth.uid() is not null);
create policy "admin escribe fuentes" on public.fuentes_consulta for all using (public.is_admin()) with check (public.is_admin());
create policy "usuarios leen lotes" on public.lotes_consulta for select using (auth.uid() is not null);
create policy "usuarios crean lotes" on public.lotes_consulta for insert with check (auth.uid() = creado_por or public.is_admin());
create policy "usuarios leen items" on public.items_consulta for select using (auth.uid() is not null);
create policy "usuarios leen resultados" on public.resultados_aduana for select using (auth.uid() is not null);
create policy "usuarios leen errores" on public.errores_consulta for select using (auth.uid() is not null);
create policy "solo admin lee logs html" on public.logs_html_consulta for select using (public.is_admin());

insert into public.fuentes_consulta (tipo_consulta, nombre, url_base, metodo, estado, notas) values ('BL_MARITIMO', 'Aduanas Chile - BL Maritimo', 'https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp?Action=Event', 'POST', 'activa', 'CON_ConsultaGralMFTOpageCode debe leerse dinamicamente por sesion.');
