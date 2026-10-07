# DEADLOCK / 06 — Filósofos comensales

Micrositio interactivo para la exposición de Sistemas Operativos (Grupo 06): el problema de los
filósofos comensales, las condiciones del deadlock, una simulación en tiempo real y una terminal
Debian con el laboratorio de procesos.

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

## Validación en Debian (procesos reales)

[`validacion/filosofos.py`](validacion/filosofos.py) repite la simulación con procesos reales de Linux:
cada filósofo es un proceso hijo (`fork`) y cada tenedor un semáforo del kernel. Solo necesita Python 3.

```bash
python3 validacion/filosofos.py
```

Abre una consola tipo bash con los mismos comandos de la página (`philosophers`, `forks`,
`simulation`, `deadlock`, `reset`, más `watch` y `log`). Cualquier otro comando se ejecuta en bash
real, así que el bloqueo se puede comprobar con el sistema:

```bash
deadlock                                     # provoca el deadlock con 5 procesos reales
ps -o pid,stat,wchan:22,comm -p $FILOSOFOS   # los 5 procesos dormidos (S) en el kernel
pstree -p $MESA                              # la consola y sus 5 hijos filosofo-P0 … P4
reset
simulation mode monitor                      # normal, deadlock, ordered, limited, asymmetric, monitor
simulation start
watch
```

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
