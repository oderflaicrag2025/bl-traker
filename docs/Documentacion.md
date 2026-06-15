# KPO BL Tracker - Documentacion canonica

Fecha de actualizacion: 2026-06-15
Decision vigente: **KPO BL Tracker debe migrarse como modulo interno de `Kpo-services/port-eta-dashboard`**. Este repo queda como fuente de codigo, referencia tecnica y respaldo, no como app productiva independiente.

Plan detallado vigente:

```text
docs/PLAN-MIGRACION-A-PORT-ETA-DASHBOARD.md
```

## 1. Resumen

KPO BL Tracker es un modulo web interno para consultas masivas controladas de BL maritimos. El usuario autorizado carga una lista de BL, valida datos, crea un lote, inicia manualmente el procesamiento, revisa estados y exporta resultados a Excel.

El MVP busca reducir busquedas manuales repetitivas, mejorar trazabilidad, consolidar resultados y registrar errores sin ejecutar scraping agresivo ni intentar evadir bloqueos, captcha, autenticacion o restricciones del sitio externo.

## 2. Arquitectura objetivo

La arquitectura final ya no considera desplegar este repo como segunda aplicacion. El modulo debe vivir dentro de `port-eta-dashboard`:

```text
Kpo-services/port-eta-dashboard
  /
  /bl-tracker
```

El usuario debe iniciar sesion una sola vez en el dashboard principal y acceder a BL Tracker sin autenticacion adicional.

Componentes esperados:

- Frontend principal: `Kpo-services/port-eta-dashboard`.
- Ruta BL: `/bl-tracker`.
- Auth: `AuthProvider` y `AuthGuard` existentes del dashboard principal.
- Cliente Supabase: cliente central de `port-eta-dashboard`.
- Base de datos: mismo proyecto Supabase usado por el dashboard ETA.
- Worker BL: Edge Function `process-bl-batch` desplegada en ese mismo Supabase.

## 3. Alcance incluido

- Acceso desde el dashboard ETA por boton superior `BL Tracker`.
- Ruta protegida `/bl-tracker` sin segundo login.
- Roles simples para BL: `admin` y `usuario`.
- Carga manual por pegado y archivo CSV/Excel/TXT.
- Limite inicial de 100 registros por lote.
- Validacion de vacios, formato basico y duplicados.
- Creacion de lotes de consulta.
- Procesamiento secuencial controlado con pausas.
- Maximo de 10 intentos por item.
- Registro de estados por lote e item.
- Guardado o reemplazo del resultado vigente por BL normalizado.
- Dashboard con filtros por BL, manifiesto, nave, fecha, puerto y estado.
- Detalle por consulta.
- Exportacion a Excel.
- Registro de errores y logs HTML con retencion temporal de 1 dia.
- Logs tecnicos visibles solo para administrador.

## 4. Alcance no incluido

- Despliegue independiente de `bl-traker` como segunda app.
- Segundo login para BL Tracker.
- Integracion por iframe.
- Scraping agresivo.
- Evasion de captcha, bloqueo, geolocalizacion o reglas de acceso.
- Consulta masiva sin pausas.
- App movil, marketplace o fuentes aereas/terrestres dentro del MVP inmediato.
- Procesamiento garantizado de miles de registros en primera etapa.

## 5. Flujo principal

1. Usuario inicia sesion en `port-eta-dashboard`.
2. Usuario abre `/bl-tracker` desde el boton superior.
3. Usuario pega BL o carga archivo.
4. Sistema normaliza y valida registros.
5. Sistema separa validos, invalidos y duplicados.
6. Usuario crea lote.
7. Usuario inicia manualmente el procesamiento.
8. Worker `process-bl-batch` consulta Aduanas de forma secuencial con pausas.
9. Sistema guarda resultado vigente o error por item.
10. Usuario revisa dashboard, cola y detalle.
11. Usuario exporta Excel segun filtros aplicados.

## 6. Roles

Administrador BL:

- Ve logs tecnicos.
- Exporta resultados.
- Reintenta consultas.
- Revisa soporte operativo.
- Puede administrar perfiles BL si se habilita UI para ello.

Usuario autorizado:

- Carga datos.
- Crea lotes.
- Ejecuta y reintenta consultas.
- Exporta resultados.
- No ve logs tecnicos.

En la primera integracion, los roles BL pueden mantenerse en `public.profiles`. Si el dashboard principal incorpora roles compartidos, se debe unificar la fuente de verdad.

## 7. Estados

Lote:

```text
borrador, validado, en_cola, procesando, completado, completado_con_errores, cancelado, fallido
```

Item:

```text
pendiente, validado, omitido_duplicado, en_proceso, exitoso, sin_resultado, error_temporal, error_permanente, agotado_por_reintentos, cancelado
```

Fuente:

```text
activa, en_revision, inactiva
```

## 8. Fuente Aduanas maritima confirmada

URL confirmada:

```text
https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp?Action=Event
```

Metodo observado: POST.

Campos de formulario observados:

- `EdNroManifiesto`.
- `EdNroGuia`.
- `CON_ConsultaGralMFTOpageCode`.
- `EventSource`.
- `EventName`.
- `totalManifiestos`.

`CON_ConsultaGralMFTOpageCode` no debe tratarse como constante. Debe leerse dinamicamente desde el formulario inicial antes de consultar.

Cookies observadas: `AWSALB`, `AWSALBCORS`, `AWSALBTG`, `AWSALBTGCORS` y `JSESSIONID`. No deben exponerse en frontend ni guardarse completas en logs visibles.

## 9. Campos maritimos a extraer

Datos de manifiesto:

- Nro. Manifiesto.
- Nave.
- Sentido.
- Fecha Arribo/Zarpe Estimado.
- Cia Naviera.
- Fecha Emision Manifiesto.

Datos de BL:

- Nro BL.
- Emisor.
- Fecha de Emision.
- Fecha de Aceptacion.
- Fecha de Embarque.
- Almacen.
- Puerto Embarque.
- Puerto Desembarque.
- Ultimo Transbordo.
- Total Peso.

Ejemplo confirmado para `MEDUWU951960`: manifiesto `271842`, nave `MSC TIANPING`, sentido `INGRESO`, fecha estimada `21/06/2026 23:00`, cia naviera `MSC CHILE S.A.`, almacen `SAN ANTONIO TERMINAL INTERNACIONAL S.A.`, puerto embarque `Ningbo`, puerto desembarque `San Antonio` y total peso `18274.3`.

## 10. Modelo de datos recomendado

Tablas BL en el mismo Supabase del dashboard ETA:

- `profiles`.
- `fuentes_consulta`.
- `lotes_consulta`.
- `items_consulta`.
- `resultados_aduana`.
- `errores_consulta`.
- `logs_html_consulta`.

Reglas clave:

- `resultados_aduana` debe tener indice unico por `tipo_consulta + identificador_normalizado`.
- El resultado vigente reemplaza al anterior.
- Errores y logs HTML expiran despues de 1 dia.
- No se guardan secretos ni cookies completas en campos visibles.
- Logs HTML visibles solo para admin.

Antes de ejecutar migraciones en el Supabase principal, revisar conflictos con objetos existentes: `profiles`, `user_role`, `is_admin()` y `pg_cron`.

## 11. Reintentos

Cada item tiene maximo 10 intentos. Al llegar a 10 sin exito queda como `agotado_por_reintentos`.

Errores reintentables:

- Timeout.
- 403 temporal.
- 5xx.
- Conexion fallida.
- Respuesta incompleta.
- Fuente temporalmente no disponible.

Errores no reintentables automaticamente:

- BL vacio.
- Formato invalido.
- Captcha.
- Bloqueo con intervencion humana.
- Cambio de formulario.
- Parser roto.
- Respuesta incompatible.

## 12. Exportacion Excel

Hoja `Resultados`:

- Lote.
- Fecha consulta.
- Estado item.
- Nro BL.
- Nro Manifiesto.
- Nave.
- Sentido.
- Fecha Arribo/Zarpe Estimado.
- Cia Naviera.
- Fecha Emision Manifiesto.
- Emisor BL.
- Fecha Emision BL.
- Fecha Aceptacion.
- Fecha Embarque.
- Almacen.
- Puerto Embarque.
- Puerto Desembarque.
- Ultimo Transbordo.
- Total Peso.
- Fuente.
- Intentos.
- Error Resumen.

Hoja `Errores`:

- Lote.
- Identificador Original.
- Identificador Normalizado.
- Estado.
- Tipo Error.
- Mensaje Usuario.
- Status HTTP.
- Intento Actual.
- Max Intentos.
- Fecha Error.

La exportacion desde dashboard debe respetar filtros aplicados.

Exportacion de validacion previa: el usuario puede exportar el preview de carga antes de crear lote. El archivo incluye hojas `Validos`, `Duplicados`, `Invalidos` y `Resumen`.

## 13. Avance de codigo en este repo

Este repo ya contiene:

- UI funcional en modo demo.
- Componentes principales de BL Tracker.
- Validacion e importacion de archivos.
- Cola local y exportacion Excel.
- `SupabaseBatchRepository`.
- Invocacion de worker desde `process-client.ts`.
- Migraciones SQL `001`, `002` y `003`.
- Edge Function `process-bl-batch`.
- Parser Aduanas compartido.

## 14. Pendientes reales

Los pendientes ahora se ejecutan principalmente en el repo `port-eta-dashboard`:

- Migrar frontend como feature interna.
- Reutilizar auth y cliente Supabase del dashboard principal.
- Scopear CSS.
- Copiar migraciones al repo principal.
- Ejecutar migraciones en el Supabase compartido.
- Desplegar `process-bl-batch` en el Supabase compartido.
- Validar red real contra Aduanas.
- Confirmar tiempos promedio por consulta y pausa minima segura para 100 registros.
- Validar si 403 depende de VPN, localidad, IP, red, cookies, headers u horario.
- Agregar fixtures completos reales: `01-403-Forbidden.html`, `02-Manifiestos-x-BLs-sin-datos.html`, `03-Manifiestos-x-BLs.html`.
- Confirmar comportamiento exacto de BL inexistente posterior a una busqueda real.

## 15. Criterios de aceptacion MVP

- Usuario autorizado inicia sesion una sola vez en `port-eta-dashboard`.
- Usuario entra a `/bl-tracker` sin segundo login.
- Usuario carga o pega hasta 100 BL maritimos.
- Sistema valida vacios, formato y duplicados.
- Usuario crea lote valido.
- Procesamiento se inicia manualmente.
- Consulta exitosa guarda/reemplaza resultado vigente.
- 403, timeout, sin resultado y parser roto quedan registrados sin romper lote.
- Ningun item supera 10 intentos.
- Todos los usuarios autorizados pueden reintentar y exportar.
- Solo admin puede ver logs.
- Dashboard filtra por BL, manifiesto, nave, puerto, fecha y estado.
- Excel contiene columnas definidas y hoja de errores cuando aplica.
- Logs HTML y errores tecnicos expiran o se limpian despues de 1 dia.
- La app no intenta evadir restricciones del sitio externo.
- Dashboard ETA sigue funcionando sin regresion.
