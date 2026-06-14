# Conexiones pendientes y trabajo faltante — KPO BL Tracker

Fecha: 2026-06-13 · Estado: frontend demo desplegable; backend real **codificado pero sin conectar**.

Este documento mapea **cada conexión** del sistema, qué quedó **escrito en código** y qué falta
por hacer fuera del entorno (credenciales, despliegue, validación contra el sitio real).
Es la guía para pasar de "demo" a "datos reales".

---

## 1. Mapa de componentes y conexiones

```
  [ Navegador / Frontend React ]
        |  (1) leer/crear lote        (2) invocar worker
        v                                   |
  [ Supabase: Postgres + Auth ] <-----------+
        ^   ^                               |
        |   | (4) escribe resultados        v
        |   +-------------------- [ Worker: Edge Function process-bl-batch ]
        |                                   |  (3) GET pageCode + POST consulta
        | (5) cron limpieza                 v
        +--------------------------- [ Aduanas Chile (isidora.aduana.cl) ]
```

| # | Conexión | Estado | Dónde |
|---|----------|--------|-------|
| 1 | Frontend ↔ Supabase (datos) | 🟡 **Código listo**, falta proyecto + credenciales | `src/lib/supabase-batch-repository.ts`, `src/lib/supabase-client.ts` |
| — | Frontend ↔ Supabase (auth) | 🟡 **Código listo**, falta usuarios reales | `src/lib/auth.ts`, `src/components/Login.tsx` |
| 2 | Frontend ↔ Worker (invocar) | 🟡 **Código listo**, falta function desplegada | `src/lib/process-client.ts` |
| 3 | Worker ↔ Aduanas (scraping) | 🟠 **Código de referencia**, falta validar contra sitio real | `supabase/functions/process-bl-batch/index.ts` |
| 4 | Worker ↔ Supabase (escritura) | 🟡 **Código listo**, falta service_role en secrets | mismo worker + RLS |
| 5 | Limpieza por retención (cron) | 🟡 **SQL listo**, falta habilitar pg_cron | `supabase/migrations/003_limpieza_retencion.sql` |

Leyenda: 🟢 funcionando · 🟡 código completo, requiere setup externo · 🟠 código que requiere validación con el sitio real.

---

## 2. Qué quedó hecho en esta fase (código)

- **Capa de datos Supabase** (`SupabaseBatchRepository`) que implementa la misma interfaz
  `BatchRepository` que el modo local; la UI no cambia. Mapea snake_case ↔ camelCase y lee
  lotes → items → resultado/errores en una sola consulta anidada.
- **Selector por entorno**: `batchRepository` usa Supabase si `VITE_AUTH_MODE=supabase`, si no localStorage.
- **Auth real**: `signIn` / `signOut` / rehidratación de sesión + rol desde `profiles`. `Login`
  hace login real en modo supabase y mantiene acceso directo en demo.
- **Invocación del worker** desde el botón "Procesar" (solo en modo supabase).
- **Worker** (`process-bl-batch`): procesa items secuencialmente con pausas, lee `pageCode`
  dinámico + cookies, parsea con el parser compartido, escribe resultado/error/log y recalcula
  totales del lote. **No evade** captcha/403/bloqueos.
- **Migraciones nuevas**:
  - `002_escritura_cliente_y_auth.sql`: políticas UPDATE de lotes/items para el dueño, INSERT de
    items, trigger de dueño automático del lote y auto-creación de `profiles` al registrarse.
  - `003_limpieza_retencion.sql`: función `purgar_expirados()` + agenda diaria con pg_cron.

---

## 3. Qué falta por conexión (pasos concretos)

### (1)(2)(4) Supabase — datos, auth y escritura del worker
1. Crear proyecto en Supabase y copiar `Project URL` y `anon key` al `.env`:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_MODE=supabase`.
2. Ejecutar migraciones en orden: `001_initial_schema.sql`, `002_escritura_cliente_y_auth.sql`,
   `003_limpieza_retencion.sql` (SQL Editor o `supabase db push`).
3. Crear usuarios en **Auth** (el trigger crea su fila en `profiles` con rol `usuario`).
   Para un admin: `update public.profiles set rol='admin' where email='...';`
4. Verificar: login real, crear un lote desde la app → debe aparecer en `lotes_consulta`/`items_consulta`.

### (3)(4) Worker ↔ Aduanas — la pieza que trae datos reales
1. Desplegar la function: `supabase functions deploy process-bl-batch`.
2. Cargar secrets: `supabase secrets set PROCESSING_PAUSE_MS=1500 ADUANAS_TIMEOUT_MS=20000 MAX_ITEMS_POR_INVOCACION=100`
   (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase).
3. **Validar contra el sitio real** (no se pudo desde el entorno del agente):
   - Confirmar la URL del formulario inicial (`ADUANAS_FORM_URL`) y que `extractPageCode` la encuentra.
   - Confirmar el set exacto de campos del POST (`EdNroManifiesto`, `EdNroGuia`, `CON_ConsultaGralMFTOpageCode`, `EventSource`, `EventName`, `totalManifiestos`).
   - Revisar si 403 depende de IP/VPN/horario/cookies; medir tiempo por consulta y ajustar la pausa.
   - Cargar fixtures reales y verificar el parser: `01-403-Forbidden.html`, `02-...sin-datos.html`, `03-...con-datos.html`.
4. Probar un lote pequeño real antes de operación diaria.

### (5) Limpieza por retención
1. En Supabase habilitar la extensión **pg_cron** (Database > Extensions).
2. Re-ejecutar el bloque de `003_limpieza_retencion.sql` (agenda el job 04:00 diario).
3. Alternativa sin pg_cron: invocar `select public.purgar_expirados();` desde un cron externo.

### Despliegue del frontend
1. `npm install && npm run build` (en entorno con acceso a npm).
2. Desplegar `dist/` en Vercel/Netlify con las variables `VITE_*` de producción.

---

## 4. Limitaciones conocidas / mejoras siguientes (no bloqueantes)

- **Avance en vivo del worker**: hoy el frontend invoca y recarga la lista; el progreso item a item
  no se ve en tiempo real. Mejora: suscripción **Supabase Realtime** a `items_consulta`/`lotes_consulta`.
- **Worker y tiempo de Edge Function**: lotes grandes se procesan en bloques de `MAX_ITEMS_POR_INVOCACION`.
  Para volumen alto y pausas largas, evaluar mover el worker a **Railway** (proceso persistente).
- **Cancelar durante el procesamiento real**: en modo supabase la cancelación marca el lote, pero el
  worker no consulta una señal de cancelación a mitad de corrida. Mejora: chequear `cancel_requested_at`
  dentro del loop del worker.
- **Parser duplicado**: `src/lib/aduanas-parser.ts` y `supabase/functions/_shared/aduanas-parser.ts`
  son espejos (Deno no comparte el `src/` del frontend al empaquetar). Mantener sincronizados.
- **Presupuesto**: definir tope mensual antes de activar worker persistente (Railway).

---

## 5. Resumen para decisión

- **Listo para usar ya**: frontend en modo demo (desplegable para validar UI con el negocio).
- **Listo en código, requiere tus credenciales/proyecto**: toda la integración Supabase (datos + auth)
  y la invocación del worker. Es "encender y configurar".
- **Requiere validación con red real**: el scraping de Aduanas (conexión 3). Es el único punto que
  no se puede cerrar sin acceso al sitio desde la red de producción.
