# Conexiones pendientes y trabajo faltante — migracion a `port-eta-dashboard`

Fecha: 2026-06-15
Estado: codigo BL Tracker preparado, pero la decision vigente es **migrarlo como modulo interno** del repo `Kpo-services/port-eta-dashboard`.

Este documento reemplaza la idea anterior de desplegar `bl-traker` como app separada. La guia canonica detallada esta en:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## 1. Decision vigente

BL Tracker no debe quedar como segundo despliegue web. Debe vivir como ruta interna del dashboard principal:

```text
https://<dashboard-principal>/bl-tracker
```

El usuario debe autenticarse una sola vez en `port-eta-dashboard` y acceder al modulo BL sin login adicional.

## 2. Arquitectura objetivo

```text
[Browser]
   |
   v
[port-eta-dashboard]
   |-- /                 Dashboard ETAs Portuarios
   |-- /bl-tracker       Modulo KPO BL Tracker
             |
             | usa AuthProvider/AuthGuard existente
             | usa cliente Supabase existente
             v
        [Supabase unico]
             |-- tablas ETAs: vessel_occurrences, source_statuses, scrape_runs, scrape_debug_logs
             |-- tablas BL: lotes_consulta, items_consulta, resultados_aduana, errores_consulta, logs_html_consulta, fuentes_consulta, profiles
             |-- functions: scrape-vessels, process-bl-batch
                          |
                          v
                    [Aduanas Chile]
```

## 3. Mapa de conexiones

| Conexion | Estado actual en `bl-traker` | Accion para integracion |
|---|---|---|
| UI BL Tracker | Componentes y flujo creados en este repo | Migrar a `src/features/bl-tracker` y `src/pages/BlTracker.tsx` del repo principal. |
| Router | App standalone en `src/App.tsx` | Convertir a ruta protegida `/bl-tracker` dentro de `port-eta-dashboard`. |
| Auth | Login propio preparado para Supabase | Eliminar login standalone y usar `AuthProvider`/`AuthGuard` existentes del dashboard principal. |
| Cliente Supabase | `src/lib/supabase-client.ts` propio | Reemplazar por `@/integrations/supabase/client` del dashboard principal. |
| Datos BL | `SupabaseBatchRepository` ya codificado | Migrar repositorio y apuntarlo al cliente Supabase compartido. |
| Worker BL | `supabase/functions/process-bl-batch` codificado | Copiar y desplegar en el mismo Supabase del dashboard ETA. |
| Migraciones BL | `001`, `002`, `003` listas | Copiar al repo principal con timestamp nuevo y revisar conflictos antes de ejecutar. |
| Limpieza logs | `purgar_expirados()` + `pg_cron` | Habilitar `pg_cron` en el Supabase principal o documentar cron externo. |
| CSS | CSS global propio | Scopear bajo `.bl-tracker` para no afectar Tailwind/shadcn del dashboard ETA. |

## 4. Trabajo ya hecho en este repo

- Componentes principales del flujo BL: carga, preview, tabla, detalle, cola, admin, resumen y fuentes.
- Validacion de BL, importacion CSV/TXT/TSV/Excel y exportacion Excel.
- Repositorio local y repositorio Supabase.
- Migraciones SQL para tablas BL, RLS, perfiles y limpieza.
- Edge Function `process-bl-batch` para consultar Aduanas secuencialmente con pausas y registrar resultados/errores/logs.
- Parser compartido para HTML de Aduanas.

## 5. Trabajo pendiente en `port-eta-dashboard`

1. Crear rama de integracion en el repo principal.
2. Copiar codigo frontend BL hacia `src/features/bl-tracker`.
3. Crear `src/pages/BlTracker.tsx` a partir de `src/App.tsx` de este repo.
4. Agregar ruta protegida `/bl-tracker` en `src/App.tsx` del repo principal.
5. Agregar boton superior `BL Tracker` en el dashboard ETA.
6. Reemplazar cliente Supabase propio por el cliente compartido del repo principal.
7. Quitar login propio de BL Tracker.
8. Scopear CSS bajo `.bl-tracker`.
9. Copiar migraciones BL al repo principal y ejecutarlas en ambiente dev/staging.
10. Copiar y desplegar `process-bl-batch` en el Supabase principal.
11. Validar que ETAs no tenga regresiones.
12. Validar flujo BL completo: crear lote, procesar, guardar resultado/error y exportar.

## 6. Supabase pendiente

En el mismo proyecto Supabase del dashboard principal se deben agregar los objetos BL:

- `profiles` si no existe una tabla equivalente.
- `fuentes_consulta`.
- `lotes_consulta`.
- `items_consulta`.
- `resultados_aduana`.
- `errores_consulta`.
- `logs_html_consulta`.
- Funcion `purgar_expirados()`.
- Edge Function `process-bl-batch`.

Antes de aplicar migraciones, revisar posibles conflictos con:

- `public.profiles`.
- enum `user_role`.
- funcion `public.is_admin()`.
- extension `pg_cron`.

Si hay conflicto, prefijar objetos BL, por ejemplo `bl_user_role` o `bl_is_admin()`.

## 7. Validacion contra Aduanas

Sigue pendiente validar en red real:

- Respuesta de `https://isidora.aduana.cl` desde la red donde corre `process-bl-batch`.
- Lectura dinamica de `CON_ConsultaGralMFTOpageCode`.
- Campos POST reales: `EdNroManifiesto`, `EdNroGuia`, `CON_ConsultaGralMFTOpageCode`, `EventSource`, `EventName`, `totalManifiestos`.
- Comportamiento ante 403, timeout, sin resultado y cambio de formulario.

No se debe evadir captcha, bloqueo, geolocalizacion, autenticacion ni reglas del sitio externo.

## 8. Resumen para decision

- **No desplegar** `bl-traker` como app separada.
- **No pedir segundo login** al usuario.
- **Migrar codigo** al primer repo como feature interna.
- **Usar el mismo Supabase** y el mismo sistema de autenticacion del dashboard ETA.
- **Mantener este repo** como fuente de migracion y respaldo hasta que el modulo interno quede validado.
