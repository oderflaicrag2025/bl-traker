# Validacion local de la migracion interna

Fecha: 2026-06-15

Este documento ya no valida `bl-traker` como aplicacion final independiente. La validacion principal debe hacerse dentro de `Kpo-services/port-eta-dashboard`, porque la decision vigente es migrar BL Tracker como modulo interno `/bl-tracker`.

Plan canonico:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## 1. Validacion de este repo como fuente

Este repo sigue sirviendo para validar piezas aisladas antes de migrarlas:

```bash
git clone https://github.com/oderflaicrag2025/bl-traker.git
cd bl-traker
npm install
npm run build
npm test
```

Resultado esperado:

- Compila TypeScript/Vite.
- Pasan pruebas de validacion, importacion, parser, cola y exportacion.
- La app demo local permite revisar flujo BL antes de migrar.

Este resultado no significa que la integracion final este lista; solo valida la fuente.

## 2. Validacion principal en `port-eta-dashboard`

Despues de migrar el codigo, validar en el repo principal:

```bash
git clone https://github.com/Kpo-services/port-eta-dashboard.git
cd port-eta-dashboard
npm install
npm run build
npm test
npm run lint
```

Resultado esperado:

- El dashboard ETA compila sin regresion.
- La ruta `/bl-tracker` compila dentro del mismo build.
- No existe segundo build ni segundo despliegue para BL Tracker.

## 3. Validacion de autenticacion unica

Checklist:

- [ ] Entrar a `port-eta-dashboard`.
- [ ] Iniciar sesion una sola vez.
- [ ] Abrir `/bl-tracker` desde el boton superior.
- [ ] Confirmar que no aparece login propio de BL Tracker.
- [ ] Confirmar que cerrar sesion desde el sistema principal invalida tambien el acceso a `/bl-tracker`.

## 4. Validacion de Supabase compartido

Checklist:

- [ ] BL Tracker usa el cliente Supabase de `@/integrations/supabase/client`.
- [ ] No se usa `src/lib/supabase-client.ts` propio del repo BL en la integracion final.
- [ ] No se requiere `VITE_AUTH_MODE=supabase` para produccion dentro del repo principal.
- [ ] Las tablas BL existen en el mismo proyecto Supabase del dashboard ETA.
- [ ] Las tablas ETA siguen funcionando sin cambios.

## 5. Validacion de base de datos BL

Probar en Supabase:

```sql
select count(*) from public.fuentes_consulta;
select count(*) from public.lotes_consulta;
select count(*) from public.items_consulta;
select count(*) from public.resultados_aduana;
select count(*) from public.errores_consulta;
select count(*) from public.logs_html_consulta;
```

Validar perfiles:

```sql
select email, rol, activo
from public.profiles
order by email;
```

## 6. Validacion funcional BL

Checklist manual:

- [ ] Crear lote con 1 a 3 BL.
- [ ] Confirmar escritura en `lotes_consulta`.
- [ ] Confirmar escritura en `items_consulta`.
- [ ] Procesar lote.
- [ ] Confirmar invocacion de `process-bl-batch`.
- [ ] Confirmar resultado en `resultados_aduana` o error en `errores_consulta`.
- [ ] Confirmar logs tecnicos solo para admin.
- [ ] Exportar Excel.
- [ ] Reintentar item fallido.

## 7. Validacion contra Aduanas

La validacion real requiere red de ejecucion final:

- Confirmar respuesta del formulario inicial de Aduanas.
- Confirmar lectura dinamica de `CON_ConsultaGralMFTOpageCode`.
- Confirmar campos POST.
- Medir tiempos por consulta.
- Validar comportamiento de 403, timeout y sin resultado.

No implementar evasion de restricciones externas.

## 8. Si `npm install` falla con 403

1. Verificar acceso a `https://registry.npmjs.org`.
2. Revisar proxy, VPN o firewall.
3. Probar desde otra red.
4. Ejecutar:

```bash
npm config get registry
npm ping
```

Registry esperado:

```text
https://registry.npmjs.org/
```

## 9. Criterio para cierre tecnico

La migracion queda tecnicamente validada cuando:

- `port-eta-dashboard` compila con `/bl-tracker` incluido.
- El usuario no debe autenticarse dos veces.
- ETAs sigue funcionando.
- BL Tracker crea y procesa lotes en el mismo Supabase.
- La Edge Function `process-bl-batch` escribe resultado o error.
- El CSS de BL no rompe el layout del dashboard principal.
