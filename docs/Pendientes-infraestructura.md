# Pendientes que requieren infraestructura o acceso externo

Este documento separa lo que no puede cerrarse correctamente desde el entorno del agente porque depende de Supabase, red de ejecucion, despliegue o datos reales de Aduanas.

> Actualizacion 2026-06-13: el CODIGO de la integracion (repositorio Supabase, auth, worker y
> migraciones 002/003) ya esta escrito. Lo que queda en este documento es el SETUP EXTERNO y la
> VALIDACION contra el sitio real. El mapa de conexiones esta en `docs/CONEXIONES-PENDIENTES.md`.

## Escenario A: Supabase

Pasos a ejecutar cuando exista el proyecto Supabase:

1. Crear proyecto Supabase y copiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` al `.env`.
2. Ejecutar `supabase/migrations/001_initial_schema.sql`.
3. Crear usuarios desde Supabase Auth.
4. Crear o verificar registros en `profiles` con roles `admin` y `usuario`.
5. Validar politicas RLS para lectura de lotes/items/resultados, logs HTML solo admin y administracion solo admin.
6. Probar login real con `VITE_AUTH_MODE=supabase`.
7. Crear un lote desde la app y verificar escritura en `lotes_consulta` e `items_consulta`.
8. Procesar un lote de prueba y verificar reemplazo vigente en `resultados_aduana`.

## Escenario B: Worker y red de consulta Aduanas

Pasos a ejecutar cuando se defina donde correra el worker:

1. Confirmar si el endpoint de Aduanas responde desde la red elegida.
2. Comparar comportamiento con y sin VPN, IP local, horario y headers permitidos.
3. Leer dinamicamente `CON_ConsultaGralMFTOpageCode` desde el formulario inicial.
4. Mantener cookies de sesion solo en backend/worker, nunca en frontend.
5. Configurar pausas seguras entre consultas y medir tiempo promedio para 100 registros.
6. Registrar 403, timeout, sin resultado y cambios de formulario sin evadir restricciones.
7. Guardar HTML tecnico solo para admin y con expiracion de 1 dia.

## Escenario C: Despliegue

Pasos a ejecutar antes de produccion:

1. Definir presupuesto mensual maximo.
2. Decidir si el worker vive en Vercel, Railway u otro servicio persistente.
3. Configurar variables de entorno del frontend y worker.
4. Ejecutar `npm install`, `npm run build`, `npm test` y `npm run lint` en un entorno con acceso al registro npm.
5. Configurar limpieza diaria de `errores_consulta` y `logs_html_consulta`.
6. Probar lote real pequeno antes de habilitar operacion diaria.

## Bloqueo observado en el entorno del agente

En este entorno no se pudieron instalar dependencias porque `npm install` devuelve `403 Forbidden` al descargar paquetes desde `registry.npmjs.org`. Por eso la validacion completa de build, lint y tests queda pendiente para un entorno con acceso npm habilitado.
