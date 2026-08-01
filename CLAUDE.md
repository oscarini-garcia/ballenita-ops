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
- **App Store:** [`docs/APPSTORE.md`](docs/APPSTORE.md) — la secuencia entera para enviar el
  binario y la ficha, con quién hace qué y cuándo.
- **Desplegada** en Cloudflare Pages.

## Cómo trabajar en `app/`

```bash
cd app
npm install
npm run dev          # servidor local
npm run test:watch   # tests mientras editas (ÚSALO)
npm test             # suite completa una vez
npm run build        # build de producción (PWA)
```

**Al añadir una feature, añade su test** (hay ~45 y es como se detectan regresiones):
lógica pura → `*.test.js` junto al módulo; algo con datos → test tipo `db`; UI → test de
componente (`*.test.jsx`). Entorno: Vitest + jsdom + Testing Library + `fake-indexeddb`.

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

```
app/src/
  db.js                 Dexie: esquema, CRUD, cola (outbox), instantánea
  lib/  reparto.js      motor de saldos (puro, testeado)  ·  config.js  config en caliente
        stats.js money.js ids.js skins.js native.js pwa.js
  auth/ apple.js        Sign in with Apple (web + iOS)    ·  sesion.js  token del dispositivo
  lib/  demo.js         demostración sin cuenta (directriz 2.1 de Apple)
  sync/ engine.js       orquestador (cuándo sincronizar)  ·  api.js  transporte
        tables.js
  screens/  Agenda, Expenses(Gastos), Cenas, Planes, Balances(Saldos), Stats, EventSettings,
            Events, Acceso
  components/ WhaleLogo.jsx  ·  App.jsx  ·  theme.css / skins.css
  public/config.json    API, cliente de Apple y manifiesto OTA (leído en caliente)
  public/privacidad.html · soporte.html   las dos URL que exige la ficha de la App Store

api/
  src/  index.js        rutas del Worker   ·  repositorio.js  lectura/escritura sobre D1
        tablas.js       descriptor de tablas y conversión de tipos
        apple.js sesion.js  ·  revocacion.js  avisar a Apple al darse de baja
  migraciones/0001_esquema.sql
  test/                 pruebas con node:sqlite contra el esquema real
  herramientas/sembrar-desde-jsonbin.mjs
```

## Despliegue

- **Web:** Cloudflare Pages conectado al repo; build `cd app && npm ci && npm run build`,
  salida `app/dist`. Cada push a `main` republica. Base path `/` (ya no hay subpath).
- **API:** `cd api && npm run desplegar` (wrangler). Secretos: `SESION_SECRETO` y
  `TOKEN_SERVICIO`, con `wrangler secret put`.
- **Pruebas:** `.github/workflows/pruebas.yml` corre las dos suites en cada rama.
- **OTA de iOS:** sin cambios (`ota.yml`); sube la versión en `app/package.json` y mergea.
- **Lo que no viaja por OTA** es todo lo nativo: plugins, permisos, iconos y
  `capacitor.config.json`. Eso obliga a `npm run sync:ios`, archivar y subir binario.
- Pasos completos en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md); los de la tienda, en
  [`docs/APPSTORE.md`](docs/APPSTORE.md).

## Flujo de git (IMPORTANTE)

- Rama de trabajo: `claude/group-trip-app-specs-5oto6o`. Si su PR ya está **fusionada**,
  reinicia la rama desde `main` (`git checkout -B <rama> origin/main`) y abre **PR nueva**;
  no apiles sobre historia ya fusionada.
- Commits descriptivos; **corre `npm test` antes de push**. PR en **draft** por defecto.

## Estado y pendientes

**Hecho:** eventos, familias/bungas/personas, gastos con reparto por familia + liquidación,
cenas (platos, bungas mayores/niños), planes (votación, día), agenda, estadísticas, 5 temas.
**Backend propio** (Worker + D1), cola de cambios, Sign in with Apple y alta por invitación.
**Cromo repasado** (SPECS §14.10): ⚙️ en la cabecera, punto de sync mudado a Ajustes, badge
de usuario con perfil editable (emoji/estado/foto local), modales que bloquean el scroll
del fondo y modal de progreso al comprobar versión. 102 tests en la PWA + 37 en la API,
todos en verde.

**Preparada para la App Store** (`docs/APPSTORE.md`): **baja de cuenta** desde Ajustes con
revocación ante Apple (directriz 5.1.1(v), `api/src/revocacion.js` + `POST /api/cuenta/baja`),
**modo de demostración** desde la pantalla de acceso —lo único que deja ver la app a quien no
está invitado, que es el caso de quien la revisa (directriz 2.1, `app/src/lib/demo.js`)—,
páginas de **privacidad** y **soporte** en `app/public/`, y `patch-ios.mjs` declarando el
cumplimiento de exportación, «solo iPhone» y el nombre bajo el icono. Se **retiraron OneSignal
y `@capacitor/push-notifications`**, que estaban inertes y metían un SDK de terceros en el
binario: hoy no hay push, y el porqué está en `lib/native.js`.

**Pendiente de despliegue** (pasos manuales, `docs/DESPLIEGUE.md`): crear la D1 y pegar su
`database_id`, registrar los secretos, dar de alta los identificadores de Apple, crear el
proyecto de Pages, rellenar `config.json` y **sembrar desde JSONBin**. Hasta que eso esté,
la app funciona en modo solo-local.

**Pendiente (ideas):** editar gastos/personas desde la UI · **compartir** los avatares con
foto con el grupo (hoy son locales del móvil, `lib/avatares.js`; hacerlos comunes pide
almacenamiento aparte, fuera de la sync) · lista de la compra agregada (usa
`Dish.ingredientes`) · pulir contrastes de algún tema · sacar los ~96 estilos inline de las
pantallas a CSS (rompen los temas).
