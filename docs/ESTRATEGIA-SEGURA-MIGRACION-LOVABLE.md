# Estrategia segura de migracion para no romper `port-eta-dashboard` en Lovable

Fecha: 2026-06-15
Decision vigente: migrar BL Tracker como modulo interno de `Kpo-services/port-eta-dashboard`, pero hacerlo de forma incremental y reversible para no romper el proyecto que se usa desde Lovable.

Documento relacionado:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## 1. Objetivo de esta estrategia

Agregar el modulo BL Tracker dentro de `port-eta-dashboard` sin afectar el dashboard ETA actual ni el flujo de Lovable.

El dashboard principal debe seguir funcionando durante toda la migracion:

- Login actual.
- Dashboard ETAs.
- Boton `Actualizar datos`.
- Boton `Descargar Excel`.
- Supabase actual.
- Edge Function actual `scrape-vessels`.
- Deploy actual en Lovable.

La migracion debe hacerse en una rama separada y por etapas pequenas. No se debe trabajar directo sobre `main`.

## 2. Principio principal

La integracion debe ser **aditiva**, no invasiva.

Esto significa:

- Agregar archivos nuevos antes de modificar archivos existentes.
- Tocar pocos archivos existentes.
- No cambiar el flujo ETA actual.
- No reemplazar auth actual.
- No reemplazar el cliente Supabase actual.
- No cambiar tablas ETA existentes.
- No modificar `scrape-vessels`.
- No mezclar CSS global de BL con el layout actual.

## 3. Rama de trabajo obligatoria

Crear una rama de integracion:

```bash
git checkout main
git pull
git checkout -b feature/bl-tracker-module
```

No hacer commits directos en `main`.

Lovable debe seguir apuntando al estado estable mientras la rama esta en desarrollo. Solo se fusiona a `main` cuando el build y la revision manual esten aprobados.

## 4. Archivos existentes que se pueden tocar

La primera etapa debe tocar la menor cantidad posible de archivos existentes en `port-eta-dashboard`.

Permitidos:

```text
src/App.tsx
src/pages/Index.tsx
```

Opcionales solo si es necesario:

```text
src/integrations/supabase/types.ts
.env.example
README.md
```

No tocar en primera etapa:

```text
src/hooks/use-auth.tsx
src/components/auth/AuthGuard.tsx
src/integrations/supabase/client.ts
src/lib/data-source.ts
src/lib/vessel-repo.ts
src/components/vessels/*
supabase/functions/scrape-vessels/*
```

## 5. Archivos nuevos recomendados

Crear el modulo BL en archivos nuevos:

```text
src/pages/BlTracker.tsx
src/features/bl-tracker/components/*
src/features/bl-tracker/lib/*
src/features/bl-tracker/styles.css
```

Backend nuevo, sin modificar el worker ETA:

```text
supabase/functions/process-bl-batch/*
supabase/functions/_shared/aduanas-parser.ts
```

Migraciones nuevas, con timestamp posterior a las existentes:

```text
supabase/migrations/<timestamp>_bl_tracker_schema.sql
supabase/migrations/<timestamp>_bl_tracker_policies.sql
supabase/migrations/<timestamp>_bl_tracker_retention.sql
```

## 6. Primera etapa segura: pagina placeholder

Antes de migrar toda la UI, agregar una ruta protegida minima `/bl-tracker` con una pantalla placeholder.

Objetivo: validar que Lovable/build/routing/auth no se rompen.

Ejemplo de `src/pages/BlTracker.tsx` inicial:

```tsx
export default function BlTracker() {
  return (
    <div className="container py-6">
      <h1 className="text-xl font-semibold">KPO BL Tracker</h1>
      <p className="text-sm text-muted-foreground">
        Modulo BL Tracker en preparacion.
      </p>
    </div>
  );
}
```

Luego agregar la ruta protegida en `src/App.tsx`.

Criterio de exito:

- `/` sigue funcionando.
- `/login` sigue funcionando.
- `/reset-password` sigue funcionando.
- `/bl-tracker` abre solo si hay sesion.
- `npm run build` pasa.

## 7. Boton en dashboard ETA sin cambiar la logica ETA

Agregar un boton `BL Tracker` en el header de `src/pages/Index.tsx`, usando `Link` de React Router.

El boton no debe llamar APIs ni cambiar estado del dashboard ETA. Solo navega a `/bl-tracker`.

Ejemplo:

```tsx
<Button asChild variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
  <Link to="/bl-tracker">BL Tracker</Link>
</Button>
```

No modificar `handleScrape`, `handleDownload`, `refresh`, filtros ni tabla ETA.

## 8. Migracion frontend por capas

### Capa 1: ruta y shell

- `BlTracker.tsx` placeholder.
- Ruta `/bl-tracker` protegida.
- Boton superior.
- Build validado.

### Capa 2: UI sin Supabase BL

- Copiar componentes visuales de BL.
- Copiar librerias puras: validacion, importacion, formato, exportacion.
- Mantener datos mock/local temporalmente solo dentro del modulo BL.
- No tocar Supabase aun.

### Capa 3: Supabase compartido

- Reemplazar cliente Supabase propio por:

```ts
import { supabase } from "@/integrations/supabase/client";
```

- No crear un segundo cliente Supabase.
- No cambiar `src/integrations/supabase/client.ts` salvo que sea estrictamente necesario.

### Capa 4: worker BL

- Copiar `process-bl-batch` como nueva Edge Function.
- No modificar `scrape-vessels`.
- Configurar secrets de worker BL en Supabase.

### Capa 5: activacion final

- Conectar boton `Procesar` a `process-bl-batch`.
- Validar lote pequeno.
- Recién despues mostrar el modulo como funcional.

## 9. Control de riesgo por feature flag

Durante desarrollo, se puede usar una variable opcional:

```env
VITE_ENABLE_BL_TRACKER=false
```

Uso recomendado:

- Si `false`: no mostrar boton en el header, pero la ruta puede existir para QA interno.
- Si `true`: mostrar boton `BL Tracker`.

Esto permite fusionar codigo sin exponer el modulo si todavia no esta listo.

El valor por defecto seguro debe ser `false` hasta que la migracion este validada.

## 10. CSS seguro

El CSS de BL Tracker no debe definir estilos globales que afecten el dashboard ETA.

Regla obligatoria:

```tsx
<div className="bl-tracker">
  ...contenido BL...
</div>
```

Y el CSS debe quedar prefijado:

```css
.bl-tracker .panel { ... }
.bl-tracker .btn { ... }
.bl-tracker .badge { ... }
```

Evitar en el CSS migrado:

```css
body { ... }
button { ... }
input { ... }
table { ... }
.container { ... }
.btn { ... }
.panel { ... }
.badge { ... }
```

Si se requiere una clase compartida, preferir Tailwind/shadcn del repo principal.

## 11. Base de datos segura

Las migraciones BL deben ser aditivas.

Permitido:

- Crear tablas BL nuevas.
- Crear funciones BL nuevas.
- Crear policies BL nuevas.
- Crear Edge Function BL nueva.

No permitido:

- Alterar tablas ETA existentes sin revision.
- Cambiar `vessel_occurrences`.
- Cambiar `source_statuses`.
- Cambiar `scrape_runs`.
- Cambiar `scrape_debug_logs`.
- Cambiar RPC ETA existentes.

Antes de correr migraciones BL, revisar si ya existen:

```sql
select to_regclass('public.profiles');
select to_regprocedure('public.is_admin()');
```

Si hay conflicto, adaptar nombres o unificar con cuidado.

## 12. Lovable: regla de trabajo

Como `port-eta-dashboard` se abre desde Lovable, la prioridad es mantener `main` estable.

Flujo recomendado:

1. Desarrollar en rama `feature/bl-tracker-module`.
2. Hacer commits pequenos.
3. Validar build local o GitHub Actions.
4. Abrir PR.
5. Revisar cambios antes de merge.
6. Fusionar a `main` solo cuando:
   - dashboard ETA sigue funcionando,
   - `/bl-tracker` no pide segundo login,
   - build pasa,
   - CSS no rompe layout,
   - Supabase ETA sigue funcionando.

Si Lovable permite preview de rama, probar la rama antes de merge. Si no, no se debe hacer merge hasta validar localmente.

## 13. Plan de rollback

Si algo falla despues del merge:

1. Desactivar boton con `VITE_ENABLE_BL_TRACKER=false`.
2. Si el build esta roto, revertir el ultimo commit o PR.
3. Si falla Supabase BL, no afecta ETA si las migraciones fueron aditivas.
4. Si falla `process-bl-batch`, no afecta `scrape-vessels`.

## 14. Checklist antes de merge

- [ ] El PR no modifica logica ETA innecesariamente.
- [ ] `src/App.tsx` solo agrega ruta `/bl-tracker`.
- [ ] `src/pages/Index.tsx` solo agrega boton/link o feature flag.
- [ ] `src/hooks/use-auth.tsx` no fue modificado.
- [ ] `src/integrations/supabase/client.ts` no fue reemplazado.
- [ ] `src/lib/data-source.ts` no fue alterado.
- [ ] `scrape-vessels` no fue modificado.
- [ ] CSS BL esta scopeado bajo `.bl-tracker`.
- [ ] `npm run build` pasa.
- [ ] Dashboard ETA funciona.
- [ ] Login funciona.
- [ ] `/bl-tracker` funciona sin segundo login.

## 15. Recomendacion final

La mejor manera de trabajar es en dos PRs:

### PR 1: integracion shell segura

- Crear ruta `/bl-tracker`.
- Crear placeholder.
- Agregar boton con feature flag.
- No migrar base de datos ni worker.

### PR 2: modulo funcional

- Migrar UI y librerias BL.
- Scopear CSS.
- Conectar Supabase compartido.
- Agregar migraciones BL.
- Copiar `process-bl-batch`.
- Validar flujo completo.

Este enfoque reduce el riesgo de romper Lovable y permite detectar problemas antes de mezclar todo el modulo.