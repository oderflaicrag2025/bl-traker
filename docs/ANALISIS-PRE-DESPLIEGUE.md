# Análisis pre-despliegue — KPO BL Tracker

Fecha: 2026-06-12 · Autor: revisión asistida (Claude)
Estado del repo al analizar: MVP demo funcional, sin Supabase conectado ni worker real.

## 1. Estado de salud (verificado)

| Check | Antes | Después de los fixes P0 |
|-------|-------|--------------------------|
| Dev server (`npm run dev`) | ✅ arranca y renderiza | ✅ |
| Build producción (`npm run build`) | ❌ 4 errores `tsc` | ✅ compila (exit 0) |
| Tests (`npm test`) | ❌ 1/16 falla | ✅ 16/16 |

## 2. Bloqueantes corregidos (P0)

1. **Faltaba `src/vite-env.d.ts`.** Causaba los 4 errores de `tsc -b`
   (`import.meta.env` sin tipo + imports `?raw` de fixtures sin declaración).
   Sin esto el build no compilaba → no se podía desplegar. **Creado.**
2. **Test `excel-report` fallaba** (`blob.arrayBuffer is not a function`):
   jsdom no implementa `Blob.prototype.arrayBuffer`. **Polyfill con FileReader
   añadido en el test.** No afectaba runtime, pero rompía CI.

## 3. Hallazgos para ANTES de Supabase / despliegue (P1)

### 3.1 Arquitectura — el navegador NO puede consultar Aduanas
El flujo real (scraping de `isidora.aduana.cl`) **no puede ejecutarse desde el
cliente**: CORS lo bloquea, expone IP/credenciales y el `pageCode` dinámico exige
sesión servidor. Hoy todo es simulado (`resolveDemoItem` con `setTimeout`).
**Necesitas un worker backend** (el README menciona "Worker secuencial / Railway")
que: mantenga sesión, lea `CON_ConsultaGralMFTOpageCode`, haga el POST, parsee con
`aduanas-parser.ts` y escriba en Supabase con `service_role`.
→ El cliente solo debe **leer y crear lotes**; el worker **procesa y escribe**.

### 3.2 RLS incompleto para el flujo de escritura
`001_initial_schema.sql` solo define políticas `SELECT`/`INSERT`. Faltan:
- `UPDATE` de `lotes_consulta` (estado/totales) y `items_consulta` (estado/intentos).
- `INSERT`/`UPDATE` de `resultados_aduana`, `errores_consulta`, `logs_html_consulta`.
Decisión recomendada: **toda la escritura del procesamiento va por `service_role`
en el worker** (salta RLS); el cliente anon queda solo-lectura + crear lote.

### 3.3 Limpieza de logs/errores por retención
`logs_html_consulta` y `errores_consulta` tienen `expires_at` (1 día) pero **nada
los borra**. Supabase no purga solo. Añadir **pg_cron** o una Edge Function
programada que elimine `where expires_at < now()`.

### 3.4 Autenticación real
En demo, `logged` arranca `true` salvo `VITE_AUTH_MODE=supabase`. Antes de exponer
públicamente: activar modo supabase, login real y crear fila en `profiles` con rol.

### 3.5 Patrón de repositorio ya preparado para el cambio
`BatchRepository` (interfaz) + `localBatchRepository` es un buen punto de extensión.
Crear `SupabaseBatchRepository` que implemente la misma interfaz y seleccionar por
`VITE_AUTH_MODE`. La UI no necesitaría cambios.

## 4. Calidad de código (P2)

1. ✅ **`VITE_PROCESSING_PAUSE_MS` ahora se respeta.** `App.tsx` leía un `550ms`
   hardcodeado; ahora parsea la variable de entorno (fallback 550) en
   `processingPauseMs`. Configurable sin recompilar lógica.
2. ✅ **Guard de cuota en localStorage.** `saveDemoBatches` captura
   `QuotaExceededError` y lanza `StorageQuotaError`; `App` muestra un aviso
   ("almacenamiento lleno, exporta y limpia") en vez de fallar en silencio.
   Mitigación real es migrar a Supabase.
3. **`aduanas-parser.ts`** es regex sobre HTML → frágil ante cambios del sitio.
   Tiene fixtures y tests (bien); mantener fixtures actualizadas. *(Sin cambios:
   se valida cuando exista el worker real con HTML de producción.)*
4. ✅ **Code-splitting de `exceljs` hecho.** Era un bundle único de **1.18 MB**;
   `exceljs` se importa de forma dinámica en `excel-report.ts` y `file-import.ts`.
   Resultado: bundle inicial **240 KB** + chunk `exceljs` de 938 KB cargado solo al
   exportar/importar Excel. Verificado en navegador (export funciona).
5. **`tsconfig`**: `moduleResolution: "Node"` funciona, pero `"Bundler"` es lo
   recomendado para Vite 5 (menor, opcional). *(No tocado: cambio cosmético con
   riesgo de regresión; se hará junto al setup de despliegue si conviene.)*
6. **`npm audit` (producción): 2 moderadas, ambas en `uuid` (transitivo de
   `exceljs`).** Es [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq),
   que solo aplica al pasar un `buf` a la generación de UUID — ExcelJS no lo hace,
   por lo que **no es explotable aquí**. El `npm audit fix --force` degradaría
   exceljs a 3.4.0 (breaking). **Riesgo aceptado**; revisar cuando exceljs publique
   una versión con `uuid >= 11.1.1`.

## 5. Plan sugerido (orden)

- [x] **P0** Arreglar build + test (hecho y verificado).
- [ ] **P1.a** Implementar `SupabaseBatchRepository` tras la interfaz existente.
- [ ] **P1.b** Completar migración: políticas de escritura o estrategia `service_role`.
- [ ] **P1.c** Worker de consulta a Aduanas (backend, fuera del navegador).
- [ ] **P1.d** Job de limpieza por `expires_at` (pg_cron / Edge Function).
- [ ] **P1.e** Activar auth real (`VITE_AUTH_MODE=supabase` + `profiles`).
- [x] **P2** `VITE_PROCESSING_PAUSE_MS` respetado, guard de cuota localStorage,
      code-splitting de `exceljs` (1.18 MB → 240 KB inicial), `npm audit` revisado
      (riesgo transitivo aceptado). Pendiente opcional: `moduleResolution: Bundler`
      y extraer `processBatch` a un hook (no bloqueante).

## 6. Veredicto de despliegue

El **frontend en modo demo** está listo para desplegarse (build limpio, tests
verdes, bundle optimizado). Lo que **falta para que sea funcional con datos
reales** es backend, no frontend:
- **Worker de Aduanas** (consulta real fuera del navegador) — bloqueante para datos reales.
- **Supabase** conectado (repo + RLS/`service_role` + auth real).
- **Job de limpieza** por `expires_at`.

Recomendación: desplegar ya el frontend demo para validación de UI con el negocio,
en paralelo construir el worker (define el contrato de datos que consume todo lo demás).
