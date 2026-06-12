# Backlog sin Supabase ni despliegue

Este backlog lista trabajo que todavia se puede adelantar desde el repo sin depender de Supabase, Vercel, Railway ni acceso real a Aduanas.

## Completado - 2026-06-12

1. Separacion de `src/App.tsx` en componentes fisicos ya iniciada y conectada.
   - `components/Header.tsx`
   - `components/Login.tsx`
   - `components/UploadPanel.tsx`
   - `components/FiltersBar.tsx`
   - `components/BlTable.tsx`
   - `components/QueueView.tsx`
   - `components/AdminView.tsx`
   - `components/DetailDialog.tsx`
   - `components/SourceStrip.tsx`
   - `components/Summary.tsx`

2. Interfaz de repositorio local creada.
   - `src/lib/batch-repository.ts`
   - `BatchRepository`
   - `LocalBatchRepository`
   - punto de reemplazo futuro para `SupabaseBatchRepository`

3. Pruebas iniciales de componentes principales sin dependencias nuevas.
   - Header con navegacion activa.
   - Preview de carga.
   - Tabla vacia y tabla con resultados.
   - Modal de detalle con cierre por Escape.

4. Mejoras iniciales de accesibilidad.
   - `aria-label` en botones iconicos principales.
   - `aria-current` en navegacion activa.
   - Estado vacio anunciable en tabla.
   - Modal con `role="dialog"`, `aria-modal` y cierre por teclado.

## Prioridad 1 - Calidad del frontend demo

1. Ampliar pruebas de componentes.
   - Vista cola con lote procesando/cancelado.
   - Vista admin con logs tecnicos.
   - Flujo de click para detalle y reintento.

2. Completar accesibilidad.
   - Foco inicial en modal de detalle.
   - Retorno de foco al cerrar modal.
   - Revision de contraste y nombres accesibles en controles restantes.

## Prioridad 2 - Parser y fixtures

1. Reemplazar fixtures minimos por HTML reales completos.
   - `01-403-Forbidden.html`
   - `02-Manifiestos-x-BLs-sin-datos.html`
   - `03-Manifiestos-x-BLs.html`

2. Fortalecer parser maritimo.
   - Detectar formulario roto.
   - Detectar page code faltante.
   - Separar extraccion de manifiesto y extraccion de tabla BL.
   - Guardar campos extra no mapeados en `camposExtraidosJson`.

3. Agregar pruebas de regresion.
   - HTML exitoso real.
   - HTML sin datos real.
   - 403 real.
   - HTML con contenido inyectado por extension.

## Prioridad 3 - Exportacion y reportes

1. Agregar exportacion de preview de carga.
   - Hoja `Validos`.
   - Hoja `Duplicados`.
   - Hoja `Invalidos`.

2. Mejorar Excel de resultados.
   - Filtros activados en encabezados.
   - Ancho de columnas ajustado.
   - Formato numerico para peso.
   - Hoja `Resumen` por lote.

## Prioridad 4 - Preparacion para Supabase

1. Mapear nombres frontend a columnas Supabase.
   - `BlBatch` <-> `lotes_consulta`
   - `BlItem` <-> `items_consulta`
   - `AduanaResult` <-> `resultados_aduana`
   - `ConsultationError` <-> `errores_consulta`

2. Agregar pruebas de mapping.
   - Sin conectar Supabase real.
   - Solo transformaciones de objetos.

## Prioridad 5 - Operacion demo

1. Agregar configuracion local de pausas.
   - Pausa base.
   - Pausa incremental para reintentos.
   - Maximo de intentos editable solo en modo admin demo.

2. Agregar simulador de escenarios.
   - Exito.
   - Sin resultado.
   - 403 temporal.
   - Parser roto.
   - Timeout.

3. Agregar limpieza local de logs expirados.
   - Simular retencion de 1 dia.
   - Boton admin para limpiar logs vencidos.

## Trabajo que no conviene adelantar sin infraestructura

- Login real y recuperacion de sesiones.
- RLS validada contra usuarios reales.
- Worker real consultando Aduanas.
- Limpieza programada real en base de datos.
- Validacion de 403 por red/VPN/localidad.
- Despliegue Vercel/Railway.

## Siguiente bloque recomendado

El siguiente avance mas rentable sin infraestructura es agregar exportacion Excel del preview de carga o fortalecer el parser con mas escenarios sinteticos mientras no existan los HTML reales completos.
