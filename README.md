# KPO BL Tracker

Sistema web interno para consulta masiva controlada de BL maritimos.

La documentacion canonica del alcance del proyecto esta en `docs/Documentacion.md`. Ese archivo debe mantenerse como fuente principal de decisiones, campos, reglas de negocio, pendientes y criterios de aceptacion.

## Estado actual

Este repo contiene una implementacion funcional adelantada del MVP sin depender todavia de Supabase ni despliegue:

- Dashboard React + Vite + TypeScript inspirado visualmente en `Kpo-services/port-eta-dashboard`.
- Modo demo local para trabajar sin infraestructura.
- Persistencia local de lotes demo en `localStorage` para conservar historial entre recargas.
- Carga de BL por pegado manual, CSV, TXT, TSV y Excel `.xlsx/.xls`.
- Preview de carga con registros validos, duplicados, invalidos y limite inicial de 100 registros por lote.
- Creacion de lote e inicio manual de procesamiento.
- Cola local con progreso, cancelacion, reintento de fallidos y maximo de 10 intentos por item.
- Procesamiento secuencial demo con estados por item, errores 403/sin resultado y agotamiento por reintentos.
- Tabla filtrable por BL, manifiesto, nave, puerto, estado y rango de fechas.
- Detalle por registro.
- Panel admin demo con usuarios y logs tecnicos visibles para preparar el flujo de roles.
- Exportacion Excel con hoja de resultados y hoja de errores.
- Parser maritimo inicial para HTML de Aduanas.
- Fixtures y pruebas unitarias para parser, validacion, importacion y motor de cola.
- Schema inicial de Supabase con RLS, roles y tablas principales.
- Worker de referencia en `supabase/functions/process-bl-batch`.
- Workflow CI en `.github/workflows/ci.yml` para build y tests.

## Stack

React 18, Vite, TypeScript, Supabase, ExcelJS, Zod y Vitest.

## Comandos

```bash
npm install
npm run dev
npm run build
npm test
```

Si el entorno bloquea npm o devuelve `403 Forbidden`, seguir `docs/Validacion-local.md`.

## Variables de entorno

Copia `.env.example` y completa segun el entorno:

| Variable | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL publica del proyecto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Clave anonima/publica de Supabase. |
| `VITE_AUTH_MODE` | `demo` para desarrollo sin Supabase, `supabase` para Auth real. |
| `VITE_PROCESSING_PAUSE_MS` | Pausa visual/demo entre items. En produccion debe controlarla el worker. |

## Documentos utiles

- `docs/Documentacion.md`: alcance canonico del proyecto.
- `docs/Validacion-local.md`: pasos para instalar, compilar, probar y validar fuera del entorno del agente.
- `docs/Backlog-sin-infraestructura.md`: proximos avances posibles sin Supabase, despliegue ni worker real.

## Modulos principales

- `src/App.tsx`: composicion de pantallas demo.
- `src/lib/types.ts`: tipos del dominio.
- `src/lib/bl-validation.ts`: normalizacion, validacion y preview de BL.
- `src/lib/file-import.ts`: lectura de CSV/TXT/TSV/Excel.
- `src/lib/batch-engine.ts`: cola local, totales, cancelacion y reintentos.
- `src/lib/excel-report.ts`: exportacion Excel.
- `src/lib/local-store.ts`: persistencia local temporal para modo demo.
- `src/lib/aduanas-parser.ts`: parser HTML maritimo inicial.

## Supabase

El schema inicial esta en `supabase/migrations/001_initial_schema.sql` e incluye:

- `profiles`
- `fuentes_consulta`
- `lotes_consulta`
- `items_consulta`
- `resultados_aduana`
- `errores_consulta`
- `logs_html_consulta`

## Pendientes reales

- Conectar procesamiento real contra Aduanas desde un worker controlado.
- Leer `CON_ConsultaGralMFTOpageCode` dinamicamente antes de consultar.
- Reemplazar el almacenamiento demo/local por Supabase.
- Definir red/ubicacion final del worker y validar causa de 403 con y sin VPN.
- Definir presupuesto mensual antes de activar Railway en produccion.
- Activar limpieza diaria de `errores_consulta` y `logs_html_consulta`.
- Importar los tres HTML reales completos como fixtures de prueba.
