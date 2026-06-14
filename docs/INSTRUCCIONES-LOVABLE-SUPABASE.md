# Instrucciones para Lovable / implementador: conectar KPO BL Tracker con Supabase

## Objetivo

Dejar el proyecto **KPO BL Tracker** funcionando con Supabase real dentro de la cuenta/organizacion de KPO, con autenticacion, base de datos, roles, Edge Function de procesamiento y variables de entorno necesarias para que el frontend deje de usar modo demo.

Repositorio base:

```text
https://github.com/oderflaicrag2025/bl-traker
```

## Resultado esperado

Al terminar, debe quedar:

1. Proyecto Supabase creado en la organizacion/cuenta de KPO.
2. Migraciones SQL ejecutadas en orden.
3. Supabase Auth habilitado y usuarios creados.
4. Los siguientes correos con rol **admin**:
   - `alfredo.garcia@kposervices.cl`
   - `carlos@greenwishcargo.com`
5. Frontend configurado con variables `VITE_*` y `VITE_AUTH_MODE=supabase`.
6. Edge Function `process-bl-batch` desplegada en Supabase.
7. Secrets del worker configurados solo en backend, nunca en el frontend.
8. Login real probado.
9. Creacion de lote probada desde la app.
10. Procesamiento de lote pequeno probado con datos reales o, si Aduanas devuelve 403/bloqueo, dejar el error registrado sin evadir restricciones.

---

## 1. Revisar el proyecto

El proyecto es React + Vite + TypeScript y ya trae codigo preparado para Supabase.

Comandos base:

```bash
npm install
npm run build
npm test
```

Variables frontend requeridas:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AUTH_MODE=supabase
VITE_PROCESSING_PAUSE_MS=1500
```

Importante: `VITE_SUPABASE_ANON_KEY` es publica. No colocar nunca `service_role` ni secretos reales en variables `VITE_*`.

---

## 2. Crear proyecto Supabase

Crear un proyecto Supabase nuevo en la cuenta/organizacion de KPO.

Luego copiar:

- Project URL -> `VITE_SUPABASE_URL`
- anon public key -> `VITE_SUPABASE_ANON_KEY`

Configurar esas variables en Lovable y/o en el entorno de despliegue frontend.

---

## 3. Ejecutar migraciones SQL

Ejecutar las migraciones en este orden desde Supabase SQL Editor o con Supabase CLI:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_escritura_cliente_y_auth.sql
supabase/migrations/003_limpieza_retencion.sql
```

La migracion `001` crea las tablas principales:

- `profiles`
- `fuentes_consulta`
- `lotes_consulta`
- `items_consulta`
- `resultados_aduana`
- `errores_consulta`
- `logs_html_consulta`

La migracion `002` completa politicas de escritura del cliente, trigger de dueno del lote y trigger para crear perfil al registrar usuarios.

La migracion `003` crea la funcion de limpieza de errores/logs expirados. Antes de ejecutarla, si es posible, habilitar `pg_cron` en:

```text
Supabase Dashboard > Database > Extensions > pg_cron
```

Si `pg_cron` no esta disponible, dejar documentado y ejecutar `select public.purgar_expirados();` desde un cron externo.

---

## 4. Crear usuarios y dar rol admin

Crear o invitar en Supabase Auth estos usuarios:

```text
alfredo.garcia@kposervices.cl
carlos@greenwishcargo.com
```

Despues de que existan en `auth.users`, ejecutar:

```sql
update public.profiles
set rol = 'admin', activo = true
where lower(email) in (
  'alfredo.garcia@kposervices.cl',
  'carlos@greenwishcargo.com'
);
```

Si por cualquier motivo no se crearon las filas en `profiles`, ejecutar este respaldo:

```sql
insert into public.profiles (id, email, nombre, rol, activo)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'nombre', email),
  'admin'::public.user_role,
  true
from auth.users
where lower(email) in (
  'alfredo.garcia@kposervices.cl',
  'carlos@greenwishcargo.com'
)
on conflict (id) do update
set rol = 'admin', activo = true, updated_at = now();
```

Validar:

```sql
select email, rol, activo
from public.profiles
where lower(email) in (
  'alfredo.garcia@kposervices.cl',
  'carlos@greenwishcargo.com'
);
```

---

## 5. Configurar Lovable / frontend

En Lovable, importar o conectar el repositorio y configurar el proyecto como app Vite/React.

Configurar variables de entorno del frontend:

```env
VITE_SUPABASE_URL=<Project URL de Supabase>
VITE_SUPABASE_ANON_KEY=<anon public key de Supabase>
VITE_AUTH_MODE=supabase
VITE_PROCESSING_PAUSE_MS=1500
```

Verificar que el frontend use `VITE_AUTH_MODE=supabase`. Si queda en `demo`, la app seguira usando `localStorage` y no la base real.

Prueba minima frontend:

1. Abrir la app.
2. Iniciar sesion con un usuario creado en Supabase Auth.
3. Confirmar que el admin puede ver panel/logs admin.
4. Crear un lote de prueba con pocos BL.
5. Confirmar que aparecen registros en `lotes_consulta` e `items_consulta`.

---

## 6. Desplegar Edge Function `process-bl-batch`

La funcion esta en:

```text
supabase/functions/process-bl-batch
```

Desplegar con Supabase CLI:

```bash
supabase functions deploy process-bl-batch
```

Configurar secrets del worker:

```bash
supabase secrets set PROCESSING_PAUSE_MS=1500 ADUANAS_TIMEOUT_MS=20000 MAX_ITEMS_POR_INVOCACION=100
```

Opcionalmente, si se confirma una URL distinta para el formulario inicial de Aduanas:

```bash
supabase secrets set ADUANAS_FORM_URL="https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp"
```

No poner estos secrets en Lovable ni en variables `VITE_*`.

Notas:

- Supabase suele inyectar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Edge Functions.
- Si el entorno requiere configurar manualmente `SUPABASE_SERVICE_ROLE_KEY`, hacerlo solo en Supabase Secrets.
- No exponer `service_role` al navegador.

---

## 7. Validar procesamiento real

Desde la app:

1. Crear un lote pequeno, idealmente 1 a 3 BL.
2. Presionar procesar.
3. Confirmar que se invoque `process-bl-batch`.
4. Revisar tablas:
   - `items_consulta`
   - `resultados_aduana`
   - `errores_consulta`
   - `logs_html_consulta`
5. Confirmar que el lote pasa a `completado` o `completado_con_errores`.

Puntos que deben validarse contra la red real:

- Que Aduanas responda desde la red donde corre el worker.
- Que `CON_ConsultaGralMFTOpageCode` se lea dinamicamente desde el formulario inicial.
- Que los campos POST sigan siendo correctos:
  - `EdNroManifiesto`
  - `EdNroGuia`
  - `CON_ConsultaGralMFTOpageCode`
  - `EventSource`
  - `EventName`
  - `totalManifiestos`
- Que cookies y pageCode se manejen solo en backend.
- Que 403, timeout, sin resultado o cambios de formulario queden registrados como error sin evadir restricciones.

---

## 8. Reglas de seguridad

No hacer:

- No exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend.
- No guardar cookies completas en logs visibles.
- No intentar evadir captcha, bloqueos, geolocalizacion, autenticacion o reglas de acceso.
- No procesar consultas masivas sin pausas.
- No cambiar `VITE_AUTH_MODE` a `demo` en produccion.

Si el sitio de Aduanas devuelve 403 o bloqueo:

1. Registrar el error.
2. Medir si depende de IP, VPN, horario o red.
3. Ajustar pausa si corresponde.
4. No implementar bypass.

---

## 9. Checklist final de entrega

- [ ] Proyecto Supabase creado en cuenta/organizacion KPO.
- [ ] Variables frontend configuradas en Lovable/despliegue.
- [ ] Migracion `001_initial_schema.sql` ejecutada.
- [ ] Migracion `002_escritura_cliente_y_auth.sql` ejecutada.
- [ ] Migracion `003_limpieza_retencion.sql` ejecutada.
- [ ] `pg_cron` habilitado o alternativa de cron documentada.
- [ ] Usuarios `alfredo.garcia@kposervices.cl` y `carlos@greenwishcargo.com` creados/invitados.
- [ ] Ambos usuarios con rol `admin` en `profiles`.
- [ ] Login real validado.
- [ ] Creacion de lote validada.
- [ ] Edge Function `process-bl-batch` desplegada.
- [ ] Secrets del worker configurados.
- [ ] Lote pequeno probado.
- [ ] Resultado o error real registrado en Supabase.
- [ ] Queda documentado cualquier bloqueo de Aduanas/red.

---

## 10. Entrega esperada al equipo

Informar al terminar:

1. URL del proyecto Lovable/despliegue.
2. URL del proyecto Supabase.
3. Confirmacion de que los dos correos tienen rol admin.
4. Resultado de prueba de login.
5. Resultado de prueba de creacion de lote.
6. Resultado de prueba del worker.
7. Si hubo 403 o bloqueo de Aduanas, indicar red usada, hora, status HTTP y mensaje registrado.
