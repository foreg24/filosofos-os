# DEADLOCK / 06 — Filósofos comensales

Micrositio interactivo para la exposición de Sistemas Operativos (Grupo 06): el problema de los
filósofos comensales, las condiciones del deadlock, una simulación en tiempo real y una terminal
Debian emulada con el laboratorio de procesos.

## Ejecutar

Requiere Node.js 20 o superior.

```bash
npm install
npm run build
npm start
```

La página queda en http://127.0.0.1:3000 (solo accesible desde este equipo).

Para desarrollo: `npm run dev`. Para abrirla desde otros dispositivos de la red: `npm run dev:red` o `npm run start:red`.

## Terminal

Escribe `help` para ver los comandos y `lab` para la guía del laboratorio de procesos.

## Desplegar en Cloudflare Pages

`npm run build` genera un sitio 100 % estático en la carpeta `out/` (incluye `_headers` con las
cabeceras de seguridad). Para publicarlo:

1. Sube este repositorio a tu GitHub.
2. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y elige el repositorio.
3. Configuración de build:
   - Framework preset: `None`
   - Build command: `npm run build`
   - Build output directory: `out`
   - La versión de Node se toma de `.node-version` (22).
4. **Save and Deploy**. Cada `git push` vuelve a desplegar el sitio.

Si el proyecto se creó como **Worker** (Workers & Pages → Create → Worker → importar repositorio),
también funciona: build command `npm run build` y deploy command `npx wrangler deploy`. El archivo
`wrangler.jsonc` le indica que suba la carpeta `out` como sitio estático.

Alternativa sin Git: `npm run build` y luego `npx wrangler deploy`.
