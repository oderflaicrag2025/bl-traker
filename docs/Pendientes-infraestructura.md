# Pendientes de infraestructura para migracion interna

Fecha: 2026-06-15
Decision vigente: BL Tracker se migra como modulo interno de `Kpo-services/port-eta-dashboard`. Este documento ya no describe un despliegue standalone de `bl-traker`.

La guia principal es:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## 1. Pendientes en el repo principal

Estos pasos se ejecutan en `Kpo-services/port-eta-dashboard`, no en este repo como app productiva:

1. Crear rama de integracion.
2. Migrar componentes y librerias BL a `src/features/bl-tracker`.
3. Crear pagina `src/pages/BlTracker.tsx`.
4. Agregar ruta protegida `/bl-tracker` usando el `AuthGuard` existente.
5. Agregar boton `BL Tracker` en el header superior del dashboard ETA.
6. Reutilizar el cliente Supabase existente del repo principal.
7. Eliminar el login propio del BL Tracker migrado.
8. Scopear CSS bajo `.bl-tracker` o migrar a Tailwind/shadcn.

## 2. Pendientes Supabase

El proyecto Supabase debe ser el mismo que usa `port-eta-dashboard`.

### Migraciones BL

Copiar al repo principal y ejecutar, con timestamp nuevo, las migraciones de este repo:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_escritura_cliente_y_auth.sql
supabase/migrations/003_limpieza_retencion.sql
```

Antes de ejecutar, revisar conflictos con objetos existentes:

- `public.profiles`.
- enum `user_role`.
- funcion `public.is_admin()`.
- extension `pg_cron`.

Si hay conflicto, adaptar nombres antes de aplicar migraciones en produccion.

### Roles

El modulo BL necesita rol `admin` para panel admin y logs tecnicos.

Accion recomendada:

1. Mantener o crear tabla `profiles` en el Supabase principal.
2. Crear perfiles para usuarios existentes de `auth.users`.
3. Asignar `rol='admin'` a los usuarios que administraran BL Tracker.

## 3. Pendientes Edge Function

Copiar al repo principal:

```text
supabase/functions/process-bl-batch
supabase/functions/_shared/aduanas-parser.ts
```

Desplegar en el Supabase principal:

```bash
supabase functions deploy process-bl-batch
```

Configurar secrets solo en Supabase:

```bash
supabase secrets set PROCESSING_PAUSE_MS=1500 ADUANAS_TIMEOUT_MS=20000 MAX_ITEMS_POR_INVOCACION=100
```

Opcional:

```bash
supabase secrets set ADUANAS_FORM_URL="https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp"
```

No poner `SUPABASE_SERVICE_ROLE_KEY` ni secretos de worker en variables `VITE_*`.

## 4. Pendientes de validacion contra Aduanas

No se puede cerrar desde documentacion ni desde entorno sin red real. Hay que validar:

1. Si Aduanas responde desde la red donde corre la Edge Function.
2. Si el comportamiento cambia con VPN, IP, horario, cookies o headers.
3. Si `CON_ConsultaGralMFTOpageCode` se extrae correctamente desde el formulario inicial.
4. Si los campos POST siguen siendo correctos.
5. Si la pausa `PROCESSING_PAUSE_MS` es segura para lotes de hasta 100 BL.
6. Si 403, timeout, sin resultado y parser roto quedan registrados sin romper el lote.

No implementar bypass de captcha, bloqueo, geolocalizacion, autenticacion ni reglas del sitio externo.

## 5. Pendientes de validacion tecnica

En el repo principal, validar:

```bash
npm install
npm run build
npm test
npm run lint
```

Validaciones manuales:

- Login unico en dashboard ETA.
- Navegacion a `/bl-tracker` sin segundo login.
- Creacion de lote BL.
- Escritura en `lotes_consulta` e `items_consulta`.
- Invocacion de `process-bl-batch`.
- Resultado o error guardado en Supabase.
- Exportacion Excel BL.
- Dashboard ETA funcionando sin regresion.

## 6. Pendientes que ya no aplican

Estos puntos quedan descartados como objetivo principal:

- Desplegar `bl-traker` como segunda app Lovable/Vercel.
- Pedir autenticacion separada para BL Tracker.
- Usar iframe o link externo como solucion final.
- Mantener dos proyectos Supabase separados para ETAs y BL.

## 7. Bloqueo observado en entorno anterior

En el entorno del agente no se pudieron instalar dependencias porque `npm install` devolvia `403 Forbidden` al descargar paquetes desde `registry.npmjs.org`. La validacion completa de build/lint/tests debe hacerse en una red con acceso npm habilitado.
