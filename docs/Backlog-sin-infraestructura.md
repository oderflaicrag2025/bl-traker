# Backlog para migracion interna a `port-eta-dashboard`

Fecha: 2026-06-15

Este backlog ya no prioriza un despliegue independiente de `bl-traker`. La prioridad es migrar el codigo como modulo interno del repo `Kpo-services/port-eta-dashboard`.

Plan canonico:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## Completado en este repo

- Componentes principales del flujo BL: header, carga, filtros, tabla, cola, admin, detalle, fuentes y resumen.
- Librerias de dominio: validacion BL, importacion de archivos, motor de cola, exportacion Excel y parser Aduanas.
- Repositorio local y repositorio Supabase.
- Migraciones SQL para schema BL, politicas, perfiles y limpieza.
- Edge Function `process-bl-batch`.

## Prioridad 1 - Preparar codigo frontend

1. Convertir `src/App.tsx` en pagina interna `BlTracker.tsx`.
2. Quitar el login propio del flujo productivo.
3. Usar la sesion ya resuelta por el dashboard principal.
4. Envolver la pagina en `.bl-tracker`.
5. Mantener dashboard, carga, cola, admin, detalle y exportacion.

## Prioridad 2 - Unificar Supabase

1. Reemplazar el cliente Supabase propio por el cliente del repo principal.
2. Evitar que el modulo dependa de una app standalone.
3. Mantener `profiles` solo para roles BL si el dashboard principal no tiene roles compartidos.
4. Revisar conflictos de nombres antes de ejecutar migraciones.

## Prioridad 3 - Scopear estilos

1. Mover `src/styles.css` a `src/features/bl-tracker/styles.css`.
2. Prefijar estilos bajo `.bl-tracker`.
3. Evitar reglas globales para `body`, `button`, `table`, `.container`, `.btn`, `.panel` y `.badge`.
4. Evaluar migracion posterior a Tailwind/shadcn.

## Prioridad 4 - Migrar al repo principal

1. Crear `src/features/bl-tracker/components`.
2. Crear `src/features/bl-tracker/lib`.
3. Crear `src/pages/BlTracker.tsx`.
4. Agregar ruta protegida `/bl-tracker`.
5. Agregar boton `BL Tracker` en el header del dashboard ETA.
6. Validar navegacion sin segundo login.

## Prioridad 5 - Backend compartido

1. Copiar migraciones BL al repo principal con timestamp nuevo.
2. Ejecutar migraciones en ambiente de prueba.
3. Copiar `supabase/functions/process-bl-batch` al repo principal.
4. Desplegar la funcion en el Supabase principal.
5. Configurar variables privadas del worker en Supabase.
6. Probar lote pequeno real.

## Prioridad 6 - Pruebas

1. Portar pruebas utiles al repo principal.
2. Validar build, tests y lint.
3. Confirmar que el dashboard ETA sigue funcionando.
4. Confirmar que BL Tracker crea lotes, procesa, guarda resultados/errores y exporta Excel.

## Trabajo que no conviene adelantar en este repo

- Nuevo despliegue web standalone.
- Segundo login.
- Integracion por iframe.
- Layout o router separado.
- Funcionalidades que dupliquen el dashboard principal.

## Siguiente bloque recomendado

Preparar un PR en `Kpo-services/port-eta-dashboard` con la migracion base del modulo `/bl-tracker`, todavia sin cambios profundos de negocio. Despues conectar Supabase, worker y validacion contra Aduanas.
