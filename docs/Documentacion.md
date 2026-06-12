# KPO BL Tracker - Documentacion Canonica

Fuente original consolidada desde Google Docs: Proyecto - Plataforma de Consultas Aduana Chile, actualizado al 2026-06-11.

## Resumen

KPO BL Tracker es un sistema web interno para consultas masivas controladas de BL maritimos. El usuario autorizado carga una lista de BLs, valida datos, crea un lote, inicia manualmente el procesamiento, revisa estados y exporta resultados a Excel.

El MVP busca reducir busquedas manuales repetitivas, mejorar trazabilidad, consolidar resultados y registrar errores sin ejecutar scraping agresivo ni intentar evadir bloqueos, captcha, autenticacion o restricciones del sitio externo.

## Alcance incluido

- Login con Supabase Auth.
- Roles simples: admin y usuario.
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

## Alcance no incluido

- Scraping agresivo.
- Evasion de captcha, bloqueo, geolocalizacion o reglas de acceso.
- Consulta masiva sin pausas.
- App movil, marketplace o fuentes aereas/terrestres dentro del MVP inmediato.
- Procesamiento garantizado de miles de registros en primera etapa.

## Flujo principal

1. Usuario inicia sesion.
2. Usuario pega BLs o carga archivo.
3. Sistema normaliza y valida registros.
4. Sistema separa validos, invalidos y duplicados.
5. Usuario crea lote.
6. Usuario inicia manualmente el procesamiento.
7. Worker consulta Aduanas de forma secuencial con pausas.
8. Sistema guarda resultado vigente o error por item.
9. Usuario revisa dashboard y detalle.
10. Usuario exporta Excel segun filtros aplicados.

## Roles

Administrador: crea usuarios, ve logs tecnicos, exporta resultados, reintenta consultas y revisa soporte operativo.

Usuario autorizado: carga datos, crea lotes, ejecuta y reintenta consultas, exporta resultados y no ve logs tecnicos.

## Estados

Lote: borrador, validado, en_cola, procesando, completado, completado_con_errores, cancelado, fallido.

Item: pendiente, validado, omitido_duplicado, en_proceso, exitoso, sin_resultado, error_temporal, error_permanente, agotado_por_reintentos, cancelado.

Fuente: activa, en_revision, inactiva.

## Fuente Aduanas maritima confirmada

URL confirmada:

```text
https://isidora.aduana.cl/WebManifiestoMaritimo/Consultas/CON_BlsxMFTO.jsp?Action=Event
```

Metodo observado: POST.

Campos de formulario observados: EdNroManifiesto, EdNroGuia, CON_ConsultaGralMFTOpageCode, EventSource, EventName y totalManifiestos.

CON_ConsultaGralMFTOpageCode no debe tratarse como constante. Debe leerse dinamicamente desde el formulario inicial antes de consultar.

Cookies observadas: AWSALB, AWSALBCORS, AWSALBTG, AWSALBTGCORS y JSESSIONID. No deben exponerse en frontend ni guardarse completas en logs visibles.

## Campos maritimos a extraer

Datos de manifiesto: Nro. Manifiesto, Nave, Sentido, Fecha Arribo/Zarpe Estimado, Cia Naviera y Fecha Emision Manifiesto.

Datos de BL: Nro BL, Emisor, Fecha de Emision, Fecha de Aceptacion, Fecha de Embarque, Almacen, Puerto Embarque, Puerto Desembarque, Ultimo Transbordo y Total Peso.

Ejemplo confirmado para MEDUWU951960: manifiesto 271842, nave MSC TIANPING, sentido INGRESO, fecha estimada 21/06/2026 23:00, cia naviera MSC CHILE S.A., almacen SAN ANTONIO TERMINAL INTERNACIONAL S.A., puerto embarque Ningbo, puerto desembarque San Antonio y total peso 18274.3.

## Modelo de datos recomendado

Tablas: profiles, fuentes_consulta, lotes_consulta, items_consulta, resultados_aduana, errores_consulta y logs_html_consulta.

Reglas clave: resultados_aduana debe tener indice unico por tipo_consulta + identificador_normalizado; el resultado vigente reemplaza al anterior; errores y logs HTML expiran despues de 1 dia; no se guardan secretos ni cookies completas en campos visibles.

## Reintentos

Cada item tiene maximo 10 intentos. Al llegar a 10 sin exito queda como agotado_por_reintentos.

Errores reintentables: timeout, 403 temporal, 5xx, conexion fallida, respuesta incompleta o fuente temporalmente no disponible.

Errores no reintentables automaticamente: BL vacio, formato invalido, captcha, bloqueo con intervencion humana, cambio de formulario, parser roto o respuesta incompatible.

## Exportacion Excel

Hoja Resultados: Lote, Fecha consulta, Estado item, Nro BL, Nro Manifiesto, Nave, Sentido, Fecha Arribo/Zarpe Estimado, Cia Naviera, Fecha Emision Manifiesto, Emisor BL, Fecha Emision BL, Fecha Aceptacion, Fecha Embarque, Almacen, Puerto Embarque, Puerto Desembarque, Ultimo Transbordo, Total Peso, Fuente, Intentos y Error Resumen.

Hoja Errores: Lote, Identificador Original, Identificador Normalizado, Estado, Tipo Error, Mensaje Usuario, Status HTTP, Intento Actual, Max Intentos y Fecha Error.

La exportacion desde dashboard debe respetar filtros aplicados.

Exportacion de validacion previa: el usuario puede exportar el preview de carga antes de crear lote. El archivo incluye hojas `Validos`, `Duplicados`, `Invalidos` y `Resumen`.

## Arquitectura

Frontend: React + Vite + TypeScript. Auth y datos: Supabase. Deploy web/API liviana: Vercel. Worker largo o persistente: Railway si el volumen/pausas lo justifican. El worker debe quedar desacoplado para poder mover procesamiento sin rehacer dashboard.

## Avance sin infraestructura - 2026-06-12

Se adelanto desarrollo que no depende de Supabase ni despliegue:

- Separacion modular de tipos, validacion, importacion, cola local, formato, exportacion y datos demo.
- Separacion de `src/App.tsx` en componentes fisicos para login, cabecera, carga, filtros, tabla, cola, admin, detalle, fuentes y resumen.
- Interfaz `BatchRepository` con implementacion local para preparar el reemplazo futuro por Supabase.
- Carga real de archivos `.xlsx`, `.xls`, `.csv`, `.txt` y `.tsv` en modo local.
- Preview de carga con validos, duplicados, invalidos y truncamiento por limite de 100 registros.
- Exportacion Excel del preview de carga con hojas `Validos`, `Duplicados`, `Invalidos` y `Resumen`.
- Cola local con progreso, cancelacion, reintento de fallidos y maximo de 10 intentos por item.
- Filtros ampliados por busqueda, estado, puerto y rango de fechas.
- Panel admin demo con usuarios y logs tecnicos para preparar permisos por rol.
- Exportacion Excel aislada en modulo propio para facilitar pruebas y conexion posterior.
- Pruebas unitarias adicionales de validacion, importacion y motor de lote.
- Pruebas iniciales de componentes para cabecera, preview de carga, tabla y modal de detalle.
- Prueba de workbook para exportacion Excel del preview.
- Mejoras iniciales de accesibilidad en navegacion, botones iconicos, estados vacios y modal de detalle.

Este avance mantiene modo demo y no reemplaza la integracion real pendiente con Supabase, worker y Aduanas. Los pasos externos estan documentados en `docs/Pendientes-infraestructura.md`.

## Criterios de aceptacion MVP

- Usuario autorizado puede iniciar sesion.
- Usuario carga o pega hasta 100 BL maritimos.
- Sistema valida vacios, formato y duplicados.
- Usuario crea lote valido.
- Procesamiento se inicia manualmente y muestra progreso.
- Consulta exitosa guarda/reemplaza resultado vigente.
- 403, timeout, sin resultado y parser roto quedan registrados sin romper lote.
- Ningun item supera 10 intentos.
- Todos los usuarios autorizados pueden reintentar y exportar.
- Solo admin puede ver logs y crear usuarios.
- Dashboard filtra por BL, manifiesto, nave, puerto, fecha y estado.
- Excel contiene columnas definidas y hoja de errores cuando aplica.
- Logs HTML y errores tecnicos expiran o se limpian despues de 1 dia.
- La app no intenta evadir restricciones del sitio externo.

## Pendientes reales

- Confirmar tiempos promedio por consulta y pausa minima segura para 100 registros.
- Definir presupuesto mensual maximo antes de activar Railway.
- Definir desde que red/ubicacion correra el worker de produccion.
- Validar si 403 depende de VPN, localidad, IP, red, cookies, headers u horario.
- Implementar limpieza automatica diaria de errores y logs.
- Agregar fixtures completos reales: 01-403-Forbidden.html, 02-Manifiestos-x-BLs-sin-datos.html, 03-Manifiestos-x-BLs.html.
- Confirmar comportamiento exacto de BL inexistente posterior a una busqueda real.
