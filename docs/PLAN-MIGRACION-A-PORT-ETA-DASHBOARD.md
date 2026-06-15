# Plan de migracion: BL Tracker como modulo interno de `port-eta-dashboard`

Fecha: 2026-06-15
Decision vigente: **no desplegar `bl-traker` como segunda aplicacion**. El codigo de este repo se debe migrar como modulo interno dentro de `Kpo-services/port-eta-dashboard`.

## 1. Objetivo

Integrar KPO BL Tracker dentro del dashboard principal `Kpo-services/port-eta-dashboard` para que el usuario tenga:

- Un solo login.
- Una sola sesion Supabase.
- Un solo despliegue web.
- Un solo proyecto Supabase para ETAs y BL Tracker.
- Una ruta interna, por ejemplo `/bl-tracker`, accesible desde el header superior del dashboard ETA.

El repo `oderflaicrag2025/bl-traker` queda como fuente de codigo y documentacion de migracion, no como app productiva independiente.

## 2. Decision tecnica

### Decision elegida

Migrar `bl-traker` como feature interna del repo:

```text
Kpo-services/port-eta-dashboard
  src/
    pages/
      Index.tsx
      BlTracker.tsx
    features/
      bl-tracker/
        components/
        lib/
        styles.css
  supabase/
    functions/
      process-bl-batch/
    migrations/
      <migraciones BL Tracker>
```

### No hacer

- No desplegar `bl-traker` como segunda app Lovable/Vercel.
- No abrir `bl-traker` en iframe.
- No meter `bl-traker/` como carpeta con su propio `package.json` dentro del dashboard principal.
- No mantener dos clientes Supabase para la misma sesion.
- No mantener el login propio de BL Tracker dentro de la integracion final.

## 3. Arquitectura final esperada

```text
[Usuario autenticado]
        |
        v
[port-eta-dashboard: React + Vite]
        |
        +-- /                 -> Dashboard ETAs Portuarios
        |
        +-- /bl-tracker       -> Modulo KPO BL Tracker
                  |
                  +-- usa AuthProvider/AuthGuard existente
                  +-- usa cliente Supabase existente
                  +-- lee/escribe tablas BL en el mismo Supabase
                  +-- invoca Edge Function process-bl-batch
                                      |
                                      v
                              [Aduanas Chile]
```

El modulo BL Tracker se comporta como una pantalla mas del dashboard principal.

## 4. Supuestos confirmados

- `port-eta-dashboard` ya tiene React Router, `AuthProvider`, `AuthGuard`, cliente Supabase centralizado y header con acciones superiores.
- `bl-traker` ya tiene componentes, repositorio Supabase, migraciones y Edge Function `process-bl-batch` codificados.
- La integracion real pendiente es de arquitectura/repositorio: mover codigo, adaptar imports, compartir auth, ejecutar migraciones en el Supabase del dashboard principal y desplegar la Edge Function en ese mismo proyecto.

## 5. Mapeo de archivos

### Frontend

| Origen en `bl-traker` | Destino recomendado en `port-eta-dashboard` | Nota |
|---|---|---|
| `src/App.tsx` | `src/pages/BlTracker.tsx` | Convertir de app standalone a pagina interna. |
| `src/components/*` | `src/features/bl-tracker/components/*` | Mantener componentes, ajustar imports relativos. |
| `src/lib/*` | `src/features/bl-tracker/lib/*` | Mantener validacion, importacion, exportacion, cola y repositorio. |
| `src/styles.css` | `src/features/bl-tracker/styles.css` | Scopear bajo `.bl-tracker` o migrar a Tailwind/shadcn. |
| `src/components/Login.tsx` | No migrar a produccion | La auth la maneja `port-eta-dashboard`. Puede quedar solo como referencia. |
| `src/lib/supabase-client.ts` | No migrar completo | Reemplazar por cliente existente de `port-eta-dashboard`. |
| `src/lib/auth.ts` | Adaptar o eliminar | Usar `useAuth` existente. Mantener solo helpers de rol si hacen falta. |

### Backend Supabase

| Origen en `bl-traker` | Destino recomendado en `port-eta-dashboard` | Nota |
|---|---|---|
| `supabase/migrations/001_initial_schema.sql` | Nueva migracion en repo principal | Revisar conflictos antes de ejecutar. |
| `supabase/migrations/002_escritura_cliente_y_auth.sql` | Nueva migracion en repo principal | Adaptar si ya existe tabla/perfil de usuarios. |
| `supabase/migrations/003_limpieza_retencion.sql` | Nueva migracion en repo principal | Requiere `pg_cron` o cron alternativo. |
| `supabase/functions/process-bl-batch/*` | `supabase/functions/process-bl-batch/*` | Desplegar en el mismo proyecto Supabase del dashboard ETA. |
| `supabase/functions/_shared/aduanas-parser.ts` | `supabase/functions/_shared/aduanas-parser.ts` | Mantener sincronizado con parser frontend si se conserva duplicado. |

## 6. Fases de implementacion

### Fase 0 — Preparacion

1. Crear rama en `Kpo-services/port-eta-dashboard`, por ejemplo:
   ```bash
   git checkout -b feature/bl-tracker-module
   ```
2. Confirmar que el dashboard ETA actual compila antes de tocarlo:
   ```bash
   npm install
   npm run build
   npm test
   ```
3. Identificar el Supabase productivo/dev usado por `port-eta-dashboard`.
4. Respaldar schema actual de Supabase antes de ejecutar migraciones BL.

### Fase 1 — Crear estructura del modulo

Crear en el repo principal:

```text
src/features/bl-tracker/components
src/features/bl-tracker/lib
src/features/bl-tracker/styles.css
src/pages/BlTracker.tsx
```

Copiar componentes y librerias desde este repo, excluyendo el login standalone y el bootstrap `main.tsx`.

### Fase 2 — Convertir `App.tsx` de BL en pagina interna

El `App.tsx` de BL Tracker debe transformarse en `BlTracker.tsx`.

Cambios clave:

- Quitar `logged`, `Login`, `getCurrentSession` y `signOut` propios.
- Asumir que la ruta ya viene protegida por `AuthGuard` del dashboard principal.
- Usar `useAuth` del dashboard principal para obtener usuario y cerrar sesion si se mantiene boton de salida.
- Reemplazar cualquier texto de "modo demo sin Supabase" por estado real o por aviso de desarrollo solo si se corre localmente.

Estructura sugerida:

```tsx
export default function BlTracker() {
  return (
    <div className="bl-tracker">
      {/* contenido migrado desde App.tsx */}
    </div>
  );
}
```

### Fase 3 — Agregar ruta protegida

En `src/App.tsx` del dashboard principal, agregar:

```tsx
import BlTracker from "./pages/BlTracker";

<Route
  path="/bl-tracker"
  element={
    <AuthGuard>
      <BlTracker />
    </AuthGuard>
  }
/>
```

La ruta debe quedar antes del catch-all `*`.

### Fase 4 — Agregar boton en header superior

En el header de `src/pages/Index.tsx` del dashboard ETA, agregar un boton interno:

```tsx
import { Link } from "react-router-dom";

<Button asChild variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
  <Link to="/bl-tracker">BL Tracker</Link>
</Button>
```

Si despues se crea un layout global compartido, mover este boton al layout para que tambien se pueda volver desde BL Tracker a ETAs.

### Fase 5 — Unificar cliente Supabase

Eliminar el uso de `getSupabaseClient()` del BL Tracker migrado y reemplazarlo por el cliente central del dashboard principal:

```ts
import { supabase } from "@/integrations/supabase/client";
```

Ajustar:

- `supabase-batch-repository.ts`
- `process-client.ts`
- cualquier helper que lea `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` directamente.

En la integracion final, BL Tracker no debe depender de `VITE_AUTH_MODE=supabase`. La ruta productiva siempre debe usar Supabase porque la sesion ya existe en el dashboard principal.

### Fase 6 — Resolver roles y perfiles

BL Tracker necesita distinguir `admin` y `usuario` para logs/admin.

Opcion recomendada inicial:

- Mantener tabla `profiles` de BL Tracker en el mismo Supabase.
- Crear perfiles para usuarios existentes de `auth.users`.
- Usar `profiles.rol = 'admin'` para controlar panel admin y logs BL.

SQL de verificacion:

```sql
select id, email, rol, activo
from public.profiles
order by email;
```

Si `port-eta-dashboard` ya incorpora roles propios en el futuro, se debe fusionar la logica para evitar dos fuentes de roles.

### Fase 7 — Migraciones Supabase

En el repo principal, copiar y renombrar las migraciones BL con timestamp posterior a las migraciones existentes del dashboard ETA.

Orden logico:

1. Schema base BL: tablas, enums, indices, RLS y fuente Aduanas.
2. Escritura cliente/auth: triggers, policies, perfiles.
3. Limpieza de retencion: `purgar_expirados()` y `pg_cron` si aplica.

Antes de ejecutar:

- Revisar si ya existe `public.profiles`.
- Revisar si ya existe enum `user_role`.
- Revisar si ya existe funcion `public.is_admin()`.
- Revisar si el proyecto Supabase ya tiene `pg_cron` habilitado.

Si existe conflicto de nombres, prefijar objetos BL, por ejemplo `bl_user_role` o `bl_is_admin()`, antes de aplicar en produccion.

### Fase 8 — Edge Function `process-bl-batch`

Copiar al repo principal:

```text
supabase/functions/process-bl-batch
supabase/functions/_shared/aduanas-parser.ts
```

Desplegar:

```bash
supabase functions deploy process-bl-batch
```

Configurar secrets solo en Supabase, nunca en variables `VITE_*`:

```bash
supabase secrets set PROCESSING_PAUSE_MS=1500 ADUANAS_TIMEOUT_MS=20000 MAX_ITEMS_POR_INVOCACION=100
```

Opcional si se confirma una URL distinta:

```bash
supabase secrets set ADUANAS_FORM_URL="https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp"
```

### Fase 9 — Estilos

El CSS actual de BL Tracker usa clases globales como `.container`, `.btn`, `.panel`, `.badge`.

Para evitar conflictos con Tailwind/shadcn del dashboard principal:

1. Envolver la pagina en `<div className="bl-tracker">`.
2. Scopear selectores del CSS bajo `.bl-tracker`.
3. Evitar redefinir `body`, `button`, `input`, `table` globalmente en el CSS migrado.
4. Alternativa posterior: migrar gradualmente a componentes shadcn del dashboard principal.

### Fase 10 — Realtime y progreso

Primera version aceptable:

- El boton `Procesar` invoca `process-bl-batch`.
- Al terminar la invocacion, se recarga la lista.

Mejora posterior:

- Suscripcion Realtime a `lotes_consulta` e `items_consulta` para progreso item a item.

### Fase 11 — Validacion funcional

Checklist minimo:

- [ ] Login unico en `port-eta-dashboard`.
- [ ] Navegacion desde dashboard ETA hacia `/bl-tracker` sin pedir login de nuevo.
- [ ] Volver desde BL Tracker hacia dashboard ETA.
- [ ] Crear lote BL desde `/bl-tracker`.
- [ ] Ver filas en `lotes_consulta` e `items_consulta`.
- [ ] Invocar `process-bl-batch` desde el boton `Procesar`.
- [ ] Guardar resultado o error en Supabase.
- [ ] Exportar Excel BL.
- [ ] Panel admin BL visible solo para admin.
- [ ] Dashboard ETA sigue leyendo `vessel_occurrences` y `source_statuses` sin regresion.
- [ ] `npm run build` pasa en el repo principal.
- [ ] `npm test` pasa o se actualizan tests necesarios.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Choque de CSS global | Scopear `.bl-tracker` o migrar a Tailwind/shadcn. |
| Doble auth/login | Eliminar `Login` del BL Tracker migrado y usar `AuthGuard`. |
| Doble cliente Supabase | Usar solo `@/integrations/supabase/client`. |
| Conflicto de tabla `profiles` o funcion `is_admin` | Revisar schema antes de migrar; renombrar a prefijo `bl_` si existe conflicto. |
| Edge Function excede tiempo | Procesar por bloques con `MAX_ITEMS_POR_INVOCACION`; evaluar worker persistente si el volumen lo exige. |
| Aduanas devuelve 403 o cambia formulario | Registrar error/log, validar red/IP/horario, no evadir restricciones. |
| Migraciones rompen ETA dashboard | Aplicar primero en ambiente dev/staging y respaldar schema. |

## 8. Criterio de cierre de migracion

La migracion se considera completa cuando:

1. `bl-traker` ya no necesita desplegarse como app independiente.
2. El usuario entra a `port-eta-dashboard` una vez y accede a `/bl-tracker` sin segundo login.
3. El modulo BL usa el mismo cliente Supabase y el mismo proyecto Supabase del dashboard ETA.
4. El dashboard ETA conserva su flujo actual.
5. BL Tracker permite crear lote, procesar, ver resultados/errores y exportar Excel.
6. La Edge Function `process-bl-batch` queda desplegada en el Supabase del dashboard principal.
7. La documentacion vigente apunta a este plan y no a despliegue standalone.

## 9. Estado de este repo despues de la migracion

Cuando el modulo ya viva dentro de `port-eta-dashboard`, este repo debe quedar como:

- Referencia historica del desarrollo inicial.
- Fuente de fixtures/parser si se requiere comparar.
- Backup temporal hasta que el modulo interno este validado.

No debe tratarse como la app productiva final.
