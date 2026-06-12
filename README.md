# KPO BL Tracker

Sistema web interno para consulta masiva controlada de BL maritimos.

La documentacion canonica del alcance del proyecto esta en `docs/Documentacion.md`. Ese archivo debe mantenerse como fuente principal de decisiones, campos, reglas de negocio, pendientes y criterios de aceptacion.

## Estado actual

Este repo contiene una primera implementacion funcional del MVP:

- Dashboard React + Vite + TypeScript inspirado visualmente en `Kpo-services/port-eta-dashboard`.
- Carga de BL por pegado manual o archivo CSV/TXT.
- Validacion de formato, duplicados y limite inicial de 100 registros por lote.
- Creacion de lote e inicio manual de procesamiento.
- Procesamiento secuencial demo con estados por item, reintentos y errores 403/sin resultado.
- Tabla filtrable por BL, manifiesto, nave, puerto y estado.
- Detalle por registro.
- Exportacion Excel con hoja de resultados y hoja de errores.
- Parser maritimo inicial para HTML de Aduanas.
- Fixtures y pruebas unitarias para parser y validacion.
- Schema inicial de Supabase con RLS, roles y tablas principales.
- Worker de referencia en `supabase/functions/process-bl-batch`.

## Stack

React 18, Vite, TypeScript, Supabase, ExcelJS, Zod y Vitest.

## Comandos

```bash
npm install
npm run dev
npm run build
npm test
```

## Variables de entorno

Copia `.env.example` y completa segun el entorno:

| Variable | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL publica del proyecto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Clave anonima/publica de Supabase. |
| `VITE_AUTH_MODE` | `demo` para desarrollo sin Supabase, `supabase` para Auth real. |
| `VITE_PROCESSING_PAUSE_MS` | Pausa visual/demo entre items. En produccion debe controlarla el worker. |

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
- Definir red/ubicacion final del worker y validar causa de 403 con y sin VPN.
- Definir presupuesto mensual antes de activar Railway en produccion.
- Activar limpieza diaria de `errores_consulta` y `logs_html_consulta`.
- Importar los tres HTML reales completos como fixtures de prueba.
