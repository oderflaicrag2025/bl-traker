# Validacion local y CI

Este documento describe como ejecutar los pasos que no se pudieron completar desde el entorno del agente porque `npm install` recibio `403 Forbidden` desde el registro de npm.

## Escenario recomendado: computador local o servidor con acceso a npm

Requisitos:

- Node.js 20 o superior.
- Acceso a `https://registry.npmjs.org`.
- Git instalado.

Pasos:

```bash
git clone https://github.com/oderflaicrag2025/bl-traker.git
cd bl-traker
npm install
npm run build
npm test
```

Resultado esperado:

- `npm install` descarga dependencias y genera `package-lock.json`.
- `npm run build` compila TypeScript y genera `dist/`.
- `npm test` ejecuta pruebas de parser, validacion, importacion y cola local.

Si `npm install` falla con 403:

1. Verificar si la red corporativa bloquea `registry.npmjs.org`.
2. Revisar proxy/VPN/firewall.
3. Probar desde otra red.
4. Ejecutar:

```bash
npm config get registry
npm ping
```

El registry esperado es:

```text
https://registry.npmjs.org/
```

## Escenario GitHub Actions

El repo incluye workflow en `.github/workflows/ci.yml` para instalar dependencias, compilar y correr pruebas en cada push o pull request sobre `main`.

Si GitHub Actions falla:

- Abrir la pestaña `Actions` del repo.
- Entrar al workflow `CI`.
- Revisar el paso fallido: `npm ci`, `npm run build` o `npm test`.
- Si falla `npm ci` porque falta `package-lock.json`, ejecutar `npm install` localmente y subir el lockfile.

## Escenario Vercel futuro

Cuando se conecte Vercel:

- Build command: `npm run build`.
- Output directory: `dist`.
- Variables requeridas para modo Supabase real:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_AUTH_MODE=supabase`

Mientras no exista Supabase configurado, usar:

```text
VITE_AUTH_MODE=demo
```

## Criterio para cerrar validacion tecnica

Un bloque debe considerarse validado cuando:

- `npm install` o `npm ci` termina sin error.
- `npm run build` termina sin errores TypeScript/Vite.
- `npm test` termina con todas las pruebas en verde.
- El dashboard abre en modo demo y permite crear, procesar, reintentar, cancelar y exportar un lote.
