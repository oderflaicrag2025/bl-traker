# Tablas Supabase para integrar BL Tracker en `port-eta-dashboard`

Fecha: 2026-06-15

Este documento detalla las tablas, campos, indices, RLS, triggers y configuracion Supabase que deben incorporarse al proyecto Supabase compartido de `Kpo-services/port-eta-dashboard` para habilitar el modulo interno `/bl-tracker`.

Documento relacionado:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## 1. Regla de integracion

Las tablas BL deben agregarse al mismo proyecto Supabase que usa `port-eta-dashboard`, pero la migracion debe ser aditiva y no debe alterar las tablas ETA existentes.

No modificar sin revision:

```text
vessel_occurrences
source_statuses
scrape_runs
scrape_debug_logs
get_dashboard_vessel_data()
replace_port_occurrences()
scrape-vessels
```

## 2. Migraciones origen

El schema BL ya existe en SQL dentro de este repo:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_escritura_cliente_y_auth.sql
supabase/migrations/003_limpieza_retencion.sql
```

Al migrar al repo principal, copiar estas migraciones con timestamp nuevo y revisar conflictos antes de ejecutarlas.

## 3. Enums requeridos

```sql
create type user_role as enum ('admin', 'usuario');
create type fuente_estado as enum ('activa', 'en_revision', 'inactiva');
create type lote_estado as enum ('borrador', 'validado', 'en_cola', 'procesando', 'completado', 'completado_con_errores', 'cancelado', 'fallido');
create type item_estado as enum ('pendiente', 'validado', 'omitido_duplicado', 'en_proceso', 'exitoso', 'sin_resultado', 'error_temporal', 'error_permanente', 'agotado_por_reintentos', 'cancelado');
```

Antes de crear enums, revisar si ya existen. Si hay conflicto con nombres existentes, prefijar los de BL, por ejemplo `bl_user_role`.

## 4. Tabla `profiles`

Uso: perfiles y roles para BL Tracker.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, referencia `auth.users(id)`, cascade delete |
| `email` | `text` | requerido |
| `nombre` | `text` | opcional |
| `rol` | `user_role` | requerido, default `usuario` |
| `activo` | `boolean` | requerido, default `true` |
| `created_at` | `timestamptz` | requerido, default `now()` |
| `updated_at` | `timestamptz` | requerido, default `now()` |

RLS:

- Usuario lee su propio perfil.
- Admin lee perfiles.
- Admin administra perfiles.

Nota de integracion: si `port-eta-dashboard` ya tiene tabla `profiles` o sistema de roles, no duplicar sin revisar. Se debe unificar o renombrar la logica BL.

## 5. Tabla `fuentes_consulta`

Uso: catalogo de fuentes externas de consulta BL.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `tipo_consulta` | `text` | requerido, default `BL_MARITIMO` |
| `nombre` | `text` | requerido |
| `url_base` | `text` | requerido |
| `metodo` | `text` | requerido, default `POST` |
| `estado` | `fuente_estado` | requerido, default `activa` |
| `requiere_manifesto` | `boolean` | requerido, default `false` |
| `requiere_identificador` | `boolean` | requerido, default `true` |
| `notas` | `text` | opcional |
| `created_at` | `timestamptz` | requerido, default `now()` |
| `updated_at` | `timestamptz` | requerido, default `now()` |

Registro inicial requerido:

```sql
insert into public.fuentes_consulta (tipo_consulta, nombre, url_base, metodo, estado, notas)
values (
  'BL_MARITIMO',
  'Aduanas Chile - BL Maritimo',
  'https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp?Action=Event',
  'POST',
  'activa',
  'CON_ConsultaGralMFTOpageCode debe leerse dinamicamente por sesion.'
);
```

RLS:

- Usuarios autenticados leen fuentes.
- Solo admin escribe fuentes.

## 6. Tabla `lotes_consulta`

Uso: cabecera de cada carga/proceso de BL.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `nombre_lote` | `text` | requerido |
| `tipo_consulta` | `text` | requerido, default `BL_MARITIMO` |
| `fuente_id` | `uuid` | FK a `fuentes_consulta(id)` |
| `archivo_nombre` | `text` | opcional |
| `estado` | `lote_estado` | requerido, default `borrador` |
| `total_items` | `integer` | requerido, default `0` |
| `total_exitosos` | `integer` | requerido, default `0` |
| `total_sin_resultado` | `integer` | requerido, default `0` |
| `total_fallidos` | `integer` | requerido, default `0` |
| `total_reintentos` | `integer` | requerido, default `0` |
| `creado_por` | `uuid` | FK a `auth.users(id)` |
| `created_at` | `timestamptz` | requerido, default `now()` |
| `validated_at` | `timestamptz` | opcional |
| `started_at` | `timestamptz` | opcional |
| `finished_at` | `timestamptz` | opcional |
| `cancel_requested_at` | `timestamptz` | opcional |

Indice:

```sql
create index idx_lotes_creador_fecha on public.lotes_consulta(creado_por, created_at desc);
```

RLS:

- Usuarios autenticados leen lotes.
- Usuarios crean lotes propios.
- Usuarios actualizan sus lotes.
- Admin puede operar todos.

Trigger:

- `set_lote_creador_before`: asigna `creado_por = auth.uid()` al insertar si viene nulo.

## 7. Tabla `items_consulta`

Uso: detalle de BL por lote.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `lote_id` | `uuid` | requerido, FK a `lotes_consulta(id)`, cascade delete |
| `posicion_archivo` | `integer` | requerido |
| `tipo_consulta` | `text` | requerido, default `BL_MARITIMO` |
| `identificador_original` | `text` | requerido |
| `identificador_normalizado` | `text` | requerido |
| `nro_manifesto` | `text` | opcional |
| `estado` | `item_estado` | requerido, default `pendiente` |
| `intento_actual` | `integer` | requerido, default `0` |
| `max_intentos` | `integer` | requerido, default `10` |
| `ultimo_error` | `text` | opcional |
| `ultimo_status_http` | `integer` | opcional |
| `resultado_id` | `uuid` | FK a `resultados_aduana(id)` |
| `created_at` | `timestamptz` | requerido, default `now()` |
| `updated_at` | `timestamptz` | requerido, default `now()` |
| `started_at` | `timestamptz` | opcional |
| `finished_at` | `timestamptz` | opcional |

Indices:

```sql
create index idx_items_lote on public.items_consulta(lote_id);
create index idx_items_identificador on public.items_consulta(identificador_normalizado);
```

RLS:

- Usuarios autenticados leen items.
- Usuario inserta/actualiza items de sus propios lotes.
- Admin puede operar todos.

## 8. Tabla `resultados_aduana`

Uso: resultado vigente por BL normalizado.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `tipo_consulta` | `text` | requerido, default `BL_MARITIMO` |
| `identificador_normalizado` | `text` | requerido |
| `nro_bl` | `text` | opcional |
| `nro_manifesto` | `text` | opcional |
| `nave` | `text` | opcional |
| `sentido` | `text` | opcional |
| `fecha_arribo_zarpe_estimado` | `text` | opcional |
| `cia_naviera` | `text` | opcional |
| `fecha_emision_manifiesto` | `text` | opcional |
| `emisor` | `text` | opcional |
| `fecha_emision_bl` | `text` | opcional |
| `fecha_aceptacion` | `text` | opcional |
| `fecha_embarque` | `text` | opcional |
| `almacen` | `text` | opcional |
| `puerto_embarque` | `text` | opcional |
| `puerto_desembarque` | `text` | opcional |
| `ultimo_transbordo` | `text` | opcional |
| `total_peso` | `numeric` | opcional |
| `fuente_id` | `uuid` | FK a `fuentes_consulta(id)` |
| `ultimo_item_id` | `uuid` | FK a `items_consulta(id)` |
| `campos_extraidos_json` | `jsonb` | requerido, default `{}` |
| `consulted_at` | `timestamptz` | requerido, default `now()` |
| `updated_at` | `timestamptz` | requerido, default `now()` |

Restriccion clave:

```sql
unique (tipo_consulta, identificador_normalizado)
```

Indice:

```sql
create index idx_resultados_identificador on public.resultados_aduana(tipo_consulta, identificador_normalizado);
```

RLS:

- Usuarios autenticados leen resultados.
- Cliente no escribe resultados.
- Worker escribe usando `service_role`.

## 9. Tabla `errores_consulta`

Uso: errores por item/lote con expiracion.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `item_id` | `uuid` | requerido, FK a `items_consulta(id)`, cascade delete |
| `lote_id` | `uuid` | requerido, FK a `lotes_consulta(id)`, cascade delete |
| `tipo_error` | `text` | requerido |
| `mensaje_usuario` | `text` | requerido |
| `detalle_tecnico` | `text` | opcional |
| `status_http` | `integer` | opcional |
| `intento` | `integer` | requerido |
| `reintentable` | `boolean` | requerido, default `true` |
| `created_at` | `timestamptz` | requerido, default `now()` |
| `expires_at` | `timestamptz` | requerido, default `now() + interval '1 day'` |

Indice:

```sql
create index idx_errores_created_at on public.errores_consulta(created_at);
```

RLS:

- Usuarios autenticados leen errores.
- Cliente no escribe errores.
- Worker escribe usando `service_role`.

## 10. Tabla `logs_html_consulta`

Uso: logs tecnicos HTML para diagnostico admin, con expiracion.

| Campo | Tipo | Configuracion |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `item_id` | `uuid` | FK a `items_consulta(id)`, cascade delete |
| `lote_id` | `uuid` | FK a `lotes_consulta(id)`, cascade delete |
| `status_http` | `integer` | opcional |
| `url_final` | `text` | opcional |
| `metodo` | `text` | opcional |
| `form_data_resumen` | `jsonb` | requerido, default `{}` |
| `request_headers_resumen` | `jsonb` | requerido, default `{}` |
| `response_headers_resumen` | `jsonb` | requerido, default `{}` |
| `html_respuesta` | `text` | opcional |
| `hash_html` | `text` | opcional |
| `created_at` | `timestamptz` | requerido, default `now()` |
| `expires_at` | `timestamptz` | requerido, default `now() + interval '1 day'` |
| `visible_solo_admin` | `boolean` | requerido, default `true` |

Indice:

```sql
create index idx_logs_expires_at on public.logs_html_consulta(expires_at);
```

RLS:

- Solo admin lee logs HTML.
- Cliente no escribe logs.
- Worker escribe usando `service_role`.

## 11. Funciones y triggers

### `public.is_admin()`

Determina si `auth.uid()` corresponde a un perfil activo con rol `admin`.

Uso:

- Policies de perfiles.
- Policies de fuentes.
- Lectura de logs HTML.
- Operacion admin sobre lotes/items.

### `public.set_lote_creador()`

Trigger `before insert` sobre `lotes_consulta`.

Objetivo: no confiar en el cliente para `creado_por`; si viene nulo, asigna `auth.uid()`.

### `public.handle_new_user()`

Trigger `after insert` sobre `auth.users`.

Objetivo: crear automaticamente fila en `profiles` con rol `usuario`.

### `public.purgar_expirados()`

Borra registros vencidos de:

- `errores_consulta`.
- `logs_html_consulta`.

Se programa con `pg_cron` si esta disponible.

## 12. RLS esperada

Todas las tablas BL tienen RLS habilitado:

```sql
alter table public.profiles enable row level security;
alter table public.fuentes_consulta enable row level security;
alter table public.lotes_consulta enable row level security;
alter table public.items_consulta enable row level security;
alter table public.resultados_aduana enable row level security;
alter table public.errores_consulta enable row level security;
alter table public.logs_html_consulta enable row level security;
```

Regla general:

- Cliente autenticado puede crear lotes/items propios.
- Cliente autenticado puede leer lotes/items/resultados/errores.
- Cliente autenticado no escribe resultados/errores/logs.
- Worker escribe resultados/errores/logs con `service_role`.
- Solo admin lee logs HTML.

## 13. Configuracion Edge Function

Agregar al repo principal:

```text
supabase/functions/process-bl-batch
supabase/functions/_shared/aduanas-parser.ts
```

Desplegar:

```bash
supabase functions deploy process-bl-batch
```

Secrets recomendados:

```bash
supabase secrets set PROCESSING_PAUSE_MS=1500 ADUANAS_TIMEOUT_MS=20000 MAX_ITEMS_POR_INVOCACION=100
```

Opcional:

```bash
supabase secrets set ADUANAS_FORM_URL="https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp"
```

No poner secretos en variables `VITE_*`.

## 14. Orden seguro de ejecucion

1. Respaldar schema actual del Supabase de `port-eta-dashboard`.
2. Revisar conflictos de `profiles`, `user_role`, `is_admin()` y `pg_cron`.
3. Ejecutar migracion schema BL.
4. Ejecutar migracion de policies/triggers/auth.
5. Ejecutar migracion de limpieza.
6. Crear/verificar usuarios y roles en `profiles`.
7. Desplegar Edge Function `process-bl-batch`.
8. Configurar secrets del worker BL.
9. Probar lote pequeno en `/bl-tracker`.
10. Confirmar que dashboard ETA sigue funcionando.

## 15. Checklist de integracion

- [ ] Tablas BL creadas en el Supabase compartido.
- [ ] RLS habilitado en todas las tablas BL.
- [ ] Policies de lectura/escritura cliente aplicadas.
- [ ] Worker puede escribir con `service_role`.
- [ ] Logs HTML solo visibles para admin.
- [ ] Limpieza por retencion configurada.
- [ ] `process-bl-batch` desplegada.
- [ ] Secrets del worker configurados.
- [ ] Dashboard ETA no afectado.
- [ ] `/bl-tracker` crea lote y items.
- [ ] `/bl-tracker` procesa lote pequeno y guarda resultado o error.
