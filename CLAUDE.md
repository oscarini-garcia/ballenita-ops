# CLAUDE.md — Ballena Ops 🐋

Contexto para sesiones de Claude Code. Léelo antes de tocar nada.

## Qué es

**Ballena Ops** es una **PWA** para gestionar los eventos del grupo de amigos (viajes,
campings, findes): gastos estilo Splitwise **entre familias**, cenas, planes, agenda y
estadísticas. Es un proyecto **solo para el grupo** (sin escalar ni monetizar), con
**humor** y mascota (una ballena). Un "evento" suele ser un viaje, pero es cualquier
plan con fecha de inicio/fin. Idioma: **solo español**.

- **Diseño / fuente de la verdad:** [`docs/SPECS.md`](docs/SPECS.md) — specs de producto,
  lógica y arquitectura (§14). Si cambias comportamiento, actualiza el spec.
- **Código:** [`app/`](app/) — la PWA. Ver [`app/README.md`](app/README.md).
- **Desplegada** en GitHub Pages: https://oscarini-garcia.github.io/ballenita-ops/

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

## Arquitectura (resumen — detalle en SPECS §14)

- **React + Vite + `vite-plugin-pwa`**. Sin backend propio.
- **IndexedDB** vía **Dexie** (`app/src/db.js`). Registros con `id` de cliente + `updatedAt`.
- **Regla de oro:** se **sincronizan los hechos** (gastos, liquidaciones, cenas, planes) y
  los **saldos se calculan en local** (`app/src/lib/reparto.js`). Nunca se sincroniza un saldo.
- **Sincronización** (`app/src/sync/`): snapshot completo ↔ documento JSON compartido en
  **JSONBin**, con **merge last-write-wins + tombstones** (`app/src/lib/merge.js`,
  `sync/merge-snapshot.js`). Sync al abrir / online / foreground / cada 90 s; **PUT solo si
  hay cambios**. Sin credenciales `VITE_JSONBIN_*`, la app va **solo local** (indicador
  `● local` en la cabecera).
- **Offline-first**: iOS Safari no tiene background sync → se sincroniza en foreground
  (patrón de `counter-ops`). Requiere "Añadir a pantalla de inicio" para push/persistencia.
- **Temas** (`app/src/skins.css`, `lib/skins.js`): 5 skins + Sistema + Aleatorio (rota cada
  día). Por defecto **Abisal**. Se guardan por dispositivo. La ballena se recolorea por tema.

### Convenciones que importan
- **Dinero en céntimos enteros** (`lib/money.js`). El reparto no pierde ni inventa céntimos.
- **IDs de cliente** (`lib/ids.js`) — nunca autoincrementales (romperían el merge offline).
- **Borrados dejan tombstone** (`removeRow` en `db.js`) para que se propaguen en la sync.
- **Auth:** decidido email mágico (aún NO implementado); login = identidad, no control de
  acceso (modelo simple, clave del doc en cliente — grupo de confianza).

## Estructura de la app

```
app/src/
  db.js                 Dexie: esquema, CRUD, snapshot export/import, tombstones
  lib/  reparto.js      motor de saldos (puro, testeado)  ·  merge.js  LWW+tombstones
        stats.js money.js ids.js skins.js
  sync/ engine.js       orquestador (cuándo sincronizar)  ·  jsonbin.js  transporte
        merge-snapshot.js  tables.js
  screens/  Agenda, Expenses(Gastos), Cenas, Planes, Balances(Saldos), Stats, EventSettings, Events
  components/ WhaleLogo.jsx  ·  App.jsx  ·  theme.css / skins.css
```

## Despliegue

- GitHub Pages vía Actions (`.github/workflows/deploy.yml`), en cada push a `main`.
- Base path `/ballenita-ops/` (build con `GITHUB_PAGES=true`).
- Sync: secrets del repo `VITE_JSONBIN_ID` y `VITE_JSONBIN_KEY` (inyectados en el build).
- El repo debe ser **público** o con plan Pro para que Pages publique.

## Flujo de git (IMPORTANTE)

- Rama de trabajo: `claude/group-trip-app-specs-5oto6o`. Si su PR ya está **fusionada**,
  reinicia la rama desde `main` (`git checkout -B <rama> origin/main`) y abre **PR nueva**;
  no apiles sobre historia ya fusionada.
- Commits descriptivos; **corre `npm test` antes de push**. PR en **draft** por defecto.

## Estado y pendientes

**Hecho:** eventos, familias/bungas/personas, gastos con reparto por familia + liquidación,
cenas (platos, bungas mayores/niños), planes (votación, día), agenda, estadísticas, 5 temas,
sincronización JSONBin. ~45 tests en verde. Desplegada y sincronizando.

**Pendiente (ideas):** login por email mágico · editar gastos/personas desde la UI ·
avatares con foto (v2, comprimidas, fuera del doc de sync) · lista de la compra agregada
(usa `Dish.ingredientes`) · pulir contrastes de algún tema.
