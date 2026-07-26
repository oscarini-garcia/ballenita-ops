# CLAUDE.md — Ballena Ops 🐋

Contexto para sesiones de Claude Code. Léelo antes de tocar nada.

## Qué es

**Ballena Ops** es una **PWA** para gestionar los eventos del grupo de amigos (viajes,
campings, findes): gastos estilo Splitwise **entre familias**, cenas, planes, agenda y
estadísticas. Es un proyecto **solo para el grupo** (sin escalar ni monetizar), con
**humor** y mascota (una ballena). Un "evento" suele ser un viaje, pero es cualquier
plan con fecha de inicio/fin. Idioma: **solo español**.

- **Diseño / fuente de la verdad:** [`docs/SPECS.md`](docs/SPECS.md) — specs de producto,
  lógica y arquitectura (§14, y **§14.9** para el backend actual). Si cambias
  comportamiento, actualiza el spec.
- **Código:** [`app/`](app/) — la PWA. Ver [`app/README.md`](app/README.md).
- **Código:** [`api/`](api/) — el Worker de Cloudflare + D1.
- **Despliegue:** [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) — Cloudflare, Apple y GitHub.
- **Dónde mirar:** [`docs/mapa.md`](docs/mapa.md) — mapa del repositorio, **generado**.
- **Desplegada** en Cloudflare Pages.

## El mapa del repositorio (`docs/mapa.md`)

> ⚠️ **`docs/mapa.md` es un fichero GENERADO. No se edita a mano.** Lo compone
> `herramientas/mapa.mjs` leyendo el código; cualquier cambio a mano se pierde en la
> siguiente ejecución y la integración continua lo rechaza (`--verificar` sale con
> código 1). Si algo del mapa está mal, **está mal en el código**: arregla la cabecera
> del módulo, la tabla de rutas o el spec, y vuelve a generarlo.

```bash
node herramientas/mapa.mjs              # escribe docs/mapa.md (commitéalo)
node herramientas/mapa.mjs --contexto   # a stdout, es lo que usa el hook de arranque
node herramientas/mapa.mjs --verificar  # código 1 si docs/mapa.md no cuadra con el código
```

Al abrir sesión, el hook `SessionStart` de [`.claude/settings.json`](.claude/settings.json)
inyecta el mapa **generado en ese instante** —no el fichero guardado, que podría estar
desfasado— más el estado vivo de git. Por eso el mapa no se estudia: llega ya leído.

Dos consecuencias prácticas al tocar código:

- **La cabecera de un módulo es su entrada en el mapa.** La primera frase del docstring
  (o del comentario de cabecera, que aquí a menudo va debajo de los `import`) es lo que
  se ve. Un módulo nuevo sin cabecera sale marcado como desfase.
- **El mapa contrasta lo que está declarado dos veces** y avisa si divergen: la tabla
  `RUTAS` contra la lista de la cabecera de `api/src/index.js`, las tablas
  sincronizadas en sus cuatro declaraciones, las claves de `config.json` contra las que
  el código lee, las `VITE_*` contra las que inyecta el build. Si añades una ruta o una
  tabla, decláralas en los dos sitios o el mapa lo cantará.

## Cómo trabajar en `app/`

```bash
cd app
npm install
npm run dev          # servidor local
npm run test:watch   # tests mientras editas (ÚSALO)
npm test             # suite completa una vez
npm run build        # build de producción (PWA)
```

**Al añadir una feature, añade su test** (así se detectan las regresiones; el recuento
vivo está en [`docs/mapa.md`](docs/mapa.md)): lógica pura → `*.test.js` junto al módulo;
algo con datos → test tipo `db`; UI → test de componente (`*.test.jsx`). Entorno: Vitest
+ jsdom + Testing Library + `fake-indexeddb`.

**Y escríbele su cabecera al módulo nuevo**: la primera frase es su entrada en el mapa,
y sin ella el mapa lo marca como desfase.

## Arquitectura (resumen — detalle en SPECS §14.9)

- **React + Vite + `vite-plugin-pwa`** en `app/`; **Cloudflare Worker + D1** en `api/`.
- **IndexedDB** vía **Dexie** (`app/src/db.js`). Ya **no es la fuente de la verdad**: es la
  copia local de la instantánea del servidor **más una cola de cambios** (tabla `outbox`).
- **Regla de oro:** se **sincronizan los hechos** (gastos, liquidaciones, cenas, planes) y
  los **saldos se calculan en local** (`app/src/lib/reparto.js`). Nunca se sincroniza un saldo.
- **Sincronización** (`app/src/sync/`): se sube la **cola de cambios** (`POST /api/cambios`),
  el servidor la aplica y devuelve la instantánea, que **sustituye** la copia local. El
  servidor es la autoridad → **no hay merge en el cliente ni tombstones**. Sync al abrir /
  online / foreground / cada 90 s. Sin `config.json` apuntando a una API, la app va **solo
  local** (indicador `● local` en la cabecera).
- **Toda escritura pasa por `escribir()`/`removeRow()` en `db.js`**, que guardan el dato y su
  entrada en la cola **en la misma transacción**. No escribas en `db.<tabla>` directamente:
  el cambio no subiría nunca.
- **Auth:** Sign in with Apple **solo en la app de iOS**; el Worker firma una sesión propia
  (JWT HS256, 90 días). El alta es **por invitación** desde Ajustes; la primera cuenta de una
  instalación vacía nace administradora.
- **La web NO sincroniza**, a propósito: en navegador y PWA la app es una libreta local
  (`hayApi()` devuelve `false` si no es nativa). Ahorra todo el montaje web de Apple
  —Services ID, verificación de dominio— a cambio de exigir la app para participar.
- **Configuración en caliente:** `app/public/config.json` (API, cliente de Apple, manifiesto
  OTA). Se lee al arrancar, así que cambiarla **no** exige reconstruir ni publicar un OTA.
- **Offline-first**: iOS Safari no tiene background sync → se sincroniza en foreground
  (patrón de `counter-ops`). Requiere "Añadir a pantalla de inicio" para push/persistencia.
- **Temas** (`app/src/skins.css`, `lib/skins.js`): 5 skins + Sistema + Aleatorio (rota cada
  día). Por defecto **Abisal**. Se guardan por dispositivo. La ballena se recolorea por tema.

### Convenciones que importan
- **Dinero en céntimos enteros** (`lib/money.js`). El reparto no pierde ni inventa céntimos.
- **IDs de cliente** (`lib/ids.js`) — nunca autoincrementales (romperían el trabajo offline).
- **Borrados**: `removeRow` los encola como cambio `borrar`; el servidor marca `borrado = 1`
  y deja de transmitir la fila. **Ya no hay tombstones locales.**
- **Nombres de columna = nombres de campo** (`eventId`, `amountCents`…): el esquema de D1 usa
  camelCase a propósito, para no traducir entre la base y la app. Ver `api/src/tablas.js`.
- **En la API, los campos JSON** (`payers`, `participantIds`, `votos`, `platoIds`…) van como
  texto en SQLite y se convierten en `tablas.js`. Si añades uno, decláralo ahí.

## Estructura

**Módulo a módulo, con su descripción y sus símbolos, está en
[`docs/mapa.md`](docs/mapa.md)** — generado, así que no se queda viejo. Aquí solo para
qué es cada carpeta, que es lo que no se deduce del código:

```
app/src/     lib/       lógica pura y testeable (reparto, dinero, stats, temas, config)
             auth/      Sign in with Apple y el token de este dispositivo
             sync/      cuándo (engine) y cómo (api) se habla con el Worker
             screens/   una pantalla por fichero; las cinco de la barra las compone App.jsx
             components/ lo que se reutiliza entre pantallas
             db.js      Dexie: esquema, CRUD y cola de cambios en la misma transacción
app/public/  config.json  configuración leída en caliente al arrancar
api/src/     el Worker: rutas, repositorio sobre D1 y descriptor de tablas
api/test/    pruebas con node:sqlite contra el esquema real de la migración
herramientas/ el generador del mapa (mapa.mjs) y su escáner
```

## Despliegue

- **Web:** Cloudflare Pages conectado al repo; build `cd app && npm ci && npm run build`,
  salida `app/dist`. Cada push a `main` republica. Base path `/` (ya no hay subpath).
- **API:** `cd api && npm run desplegar` (wrangler). Secretos: `SESION_SECRETO` y
  `TOKEN_SERVICIO`, con `wrangler secret put`.
- **Pruebas:** `.github/workflows/pruebas.yml` corre las dos suites en cada rama.
- **OTA de iOS:** sin cambios (`ota.yml`); sube la versión en `app/package.json` y mergea.
- Pasos completos en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Flujo de git (IMPORTANTE)

- Rama de trabajo: `claude/group-trip-app-specs-5oto6o`. Si su PR ya está **fusionada**,
  reinicia la rama desde `main` (`git checkout -B <rama> origin/main`) y abre **PR nueva**;
  no apiles sobre historia ya fusionada.
- Commits descriptivos; **corre `npm test` antes de push**. PR en **draft** por defecto.

## En curso

Lo único que se escribe **a mano** porque no se deduce del código. El hook lo inyecta
al final del mapa. Corto y en presente; el backlog va al [`README`](README.md).

- **Pendiente de despliegue** (manual, [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)): crear
  la D1 y pegar su `database_id`, registrar los secretos, dar de alta los identificadores
  de Apple, crear el proyecto de Pages, rellenar `config.json` y **sembrar desde JSONBin**.
  Hasta entonces la app va en modo solo-local.
- **Decisión pendiente:** `config.json` declara `otaManifiesto` y `lib/native.js` tiene esa
  URL a fuego, así que nadie lee la clave. O `native.js` la lee de la configuración (y el
  manifiesto pasa a ser configurable en caliente, que es lo prometido), o se quita de
  `config.json`. El mapa lo avisa en cada sesión hasta que se decida.

## Estado

**Hecho:** eventos, familias/bungas/personas, gastos con reparto por familia + liquidación,
cenas (platos, bungas mayores/niños), planes (votación, día), agenda, estadísticas, 5 temas.
**Backend propio** (Worker + D1), cola de cambios, Sign in with Apple y alta por invitación.
Las dos suites en verde (el recuento vivo está en [`docs/mapa.md`](docs/mapa.md)).
