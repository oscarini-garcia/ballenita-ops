# Mapa de Ballena Ops 🐳

<!-- GENERADO por herramientas/mapa.mjs leyendo el código. NO se edita a mano. -->
Dónde mirar sin leerse la aplicación entera. Si algo falta aquí, falta en el código.

## ✅ Sin desfases

Cada hecho declarado dos veces coincide con su gemelo.

## Las dos piezas

- **`app/`** v0.2.0 — PWA para gestionar los eventos del grupo de amigos — gastos estilo Splitwise entre familias, offline-first. 🐳
  93 pruebas en 15 ficheros · `npm test` → `vitest run`
- **`api/`** v1.0.0 — API de Ballena Ops sobre Cloudflare Workers y D1 🐳
  28 pruebas en 3 ficheros · `npm test` → `node --test 'test/*.test.js'`

## Rutas que sirve el Worker

De la tabla `RUTAS` de `api/src/index.js`; la descripción, de la lista de su cabecera.
`exige`: `sesión` = llama a `cuentaAutenticada` · `servicio` = comprueba `TOKEN_SERVICIO`.

| | ruta | exige | qué hace |
| --- | --- | --- | --- |
| `GET` | `/api/salud` | — | comprobación sin autenticar |
| `POST` | `/api/sesion` | — | canjea un token de Apple por una sesión propia |
| `GET` | `/api/sync` | sesión | instantánea completa del grupo |
| `POST` | `/api/cambios` | sesión | aplica la cola del dispositivo y devuelve la instantánea |
| `GET` | `/api/cuentas` | sesión | quién tiene acceso (administradores) |
| `POST` | `/api/cuentas` | sesión | alta, alta por invitación y baja (administradores) |
| `POST` | `/api/importar` | servicio | aplica un volcado completo sobre la base (servicio) |

## Barra de la PWA

**Hoy** (`hoy`) · **Dinero** (`dinero`) · **Cenas** (`cenas`) · **Planes** (`planes`) · **Más** (`mas`)

## Tablas

- **Se sincronizan** (10, declaradas y contrastadas en `sync/tables.js`, `api/src/tablas.js`, la migración de D1 y Dexie): `events`, `families`, `bungas`, `persons`, `expenses`, `settlements`, `dishes`, `dinners`, `plans`, `shop`
- **Solo del servidor**: `cuenta`, `dispositivo`
- **Solo locales** (no salen del móvil): `outbox`

## Configuración que el código consulta de verdad

**Worker** (`env.*` leídas en `api/src`):

- `APPLE_AUD_IOS` — `[vars]` = "com.garciadoral.ballenitaops"
- `APPLE_AUD_WEB` — no declarada en `wrangler.toml` (secreto u opcional)
- `DB` — binding de D1 (`wrangler.toml`)
- `ORIGENES_PERMITIDOS` — `[vars]` = "http://localhost:5173"
- `SESION_SECRETO` — no declarada en `wrangler.toml` (secreto u opcional)
- `TOKEN_SERVICIO` — no declarada en `wrangler.toml` (secreto u opcional)

**PWA** (`app/public/config.json`, leído al arrancar): `api`, `otaManifiesto`

**Horneadas en el build**: `VITE_ONESIGNAL_APP_ID`, `VITE_PUSH_ENDPOINT`

## Automatizaciones

- **Publish OTA bundle** `.github/workflows/ota.yml`
  cuando: workflow_dispatch · push (branches [main]; paths ['app/**'])
  corre: `npm ci`, `npm test`, `npm run build:app` (+3 guiones de varias líneas)
- **pruebas** `.github/workflows/pruebas.yml`
  cuando: push (branches ['**']) · pull_request · workflow_dispatch
  corre: `npm ci`, `npm test`, `npm run build`, `node --test 'herramientas/*.test.mjs'`, `node herramientas/mapa.mjs --verificar`

Nada corre por horario: ningún `schedule:` en los flujos ni handler `scheduled` en el Worker.

## Módulos

Primera frase de la cabecera de cada módulo, y sus símbolos públicos debajo.

**`app/src/`**

- `App.jsx` — La cáscara de la aplicación: cabecera, barra de 5 destinos y quién manda a quién.
- `db.js` — IndexedDB desde el día 1 (§14).
  ↳ setApplyingRemote, removeRow, importSnapshot, exportSnapshot, olvidarTodo, createEvent · +48 más
- `main.jsx` — Arranque de la PWA: monta React y enciende lo que tiene que estar antes del primer píxel.

**`app/src/auth/`**

- `apple.js` — Acceso con Sign in with Apple — **solo dentro de la app de iOS**.
  ↳ entrarConApple
- `sesion.js` — La sesión de este dispositivo: el token que firmó el Worker y a quién corresponde.
  ↳ leerSesion, guardarSesion, borrarSesion, haySesion

**`app/src/components/`**

- `SubNav.jsx` — Control segmentado que vive bajo la cabecera, dentro de una pestaña, para dividir una sección en dos (p. ej. Dinero → Gastos / Saldos).
- `SyncDot.jsx` — Punto de estado de la sincronización: color + ayuda + si conviene animar. 🟢 al día · 🟡 conectado con cambios encolados · 🔴 sin red · ⚪ solo local.
  ↳ estadoSync
- `UpdateModal.jsx` — El modal que se enseña mientras la PWA se actualiza a la última versión.
- `UserBadge.jsx` — El "usuario" es una persona del evento (§ barra superior).
  ↳ getMeId
- `WhaleLogo.jsx` — Icono de Ballena Ops: "B" de Ballena como marca de agua + emoji de ballena con chorro delante.

**`app/src/lib/`**

- `avatares.js` — Foto de avatar de una persona.
  ↳ leerFoto, guardarFoto, borrarFoto, comprimirFoto
- `config.js` — Configuración del despliegue, leída **en caliente** de `config.json`.
  ↳ cargarConfiguracion, olvidarConfiguracion, estaConfigurada
- `ids.js` — IDs generados en cliente (§12.2): así dos dispositivos offline no chocan al sincronizar.
  ↳ uid, now
- `money.js` — Todo el dinero se maneja en CÉNTIMOS enteros para no arrastrar errores de coma flotante.
  ↳ eurosToCents, centsToEuros, formatCents
- `native.js` — Puente con las capacidades nativas (Capacitor).
  ↳ urlDelManifiestoOta, isNative, tap, share, checkForOtaUpdate, registerPush · +2 más
- `pwa.js` — Fuerza que la PWA cargue la última versión desplegada sin tener que quitar y volver a añadir a la pantalla de inicio.
  ↳ marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion, forzarActualizacion, UPDATE_STEPS
- `reparto.js` — Motor de reparto — el corazón de Ballena Ops (§3, §14.7 del spec).
  ↳ splitCents, expensePersonShares, computeFamilyBalances, simplifyDebts
- `scrollLock.js` — Bloqueo del scroll del fondo mientras hay un modal abierto.
  ↳ bloquearScrollDeFondo, liberarScrollDeFondo, useBloqueoDeScroll
- `skins.js` — Los temas de la app: cuáles hay, cuál toca y cómo se aplica.
  ↳ getPref, setPref, rollRandom, currentSkin, applySkin, useSkin · +2 más
- `stats.js` — Estadísticas del evento (§7).
  ↳ computeStats

**`app/src/screens/`**

- `AccesoScreen.jsx` — Puerta de entrada al grupo.
- `AgendaScreen.jsx` — «Hoy»: la agenda por días, que es la vista que une todo (§4.1).
- `BalancesScreen.jsx` — Saldos por familia y liquidación en el menor número de transferencias (§3.4).
- `CenasCompraScreen.jsx` — La lista de la compra es logística de comida (§6.6), así que en la Opción A de UX vive dentro de «Cenas» como segunda sub-pestaña, en vez de suelta en la barra.
- `CenasScreen.jsx` — Las cenas del evento: qué se come cada día y a qué bunga le toca (§6).
- `CompraScreen.jsx` — La lista de la compra compartida (§6.6): apuntar cosas y tachar lo comprado.
- `DineroScreen.jsx` — «Dinero» une las dos caras de lo económico (Opción A de UX): metes el gasto y ves quién debe a quién sin cambiar de pestaña.
- `EventSettingsScreen.jsx` — Ajustes: el cuarto de máquinas del evento y del dispositivo.
- `EventsScreen.jsx` — Elegir evento, o crear el primero (§2.5).
- `ExpensesScreen.jsx` — Alta y listado de gastos (§3.1): quién puso el dinero y entre quiénes se reparte.
  ↳ CATEGORIES
- `MasScreen.jsx` — «Más» recoge lo secundario (Opción A de UX): las estadísticas de vanidad y los ajustes del evento.
- `PlanesScreen.jsx` — Planes del evento y su votación (§4): la excursión que alguien propone y el resto valora.
- `StatsScreen.jsx` — Estadísticas del evento (§7), con las métricas con pique desactivadas de serie.

**`app/src/sync/`**

- `api.js` — Transporte contra la API propia (Worker + D1).
  ↳ hayApi, traerInstantanea, enviarCambios, listarCuentas, gestionarCuenta
- `engine.js` — El orquestador de la sincronización: decide **cuándo** se sincroniza.
  ↳ syncNow, useSyncEngine
- `tables.js` — Tablas que se sincronizan (todo lo que es "hecho" del grupo).
  ↳ SYNC_TABLES

**`api/src/`**

- `apple.js` — Verificación del token de identidad de Sign in with Apple.
  ↳ base64urlADatos, verificarTokenDeApple
- `index.js` — API de Ballena Ops sobre Cloudflare Workers y D1. 🐳
  ↳ default
- `repositorio.js` — Lectura y escritura del registro del grupo sobre D1.
  ↳ cuentaPorApple, cuentaPorId, hayAlgunaCuenta, crearCuenta, listarCuentas, anotarAcceso · +6 más
- `sesion.js` — Sesión propia: un JWT HS256 corto que el dispositivo presenta en cada petición.
  ↳ emitirSesion, verificarSesion, coincideEnTiempoConstante
- `tablas.js` — Descripción de las tablas sincronizadas: qué columnas tiene cada una y cuáles necesitan conversión al cruzar la frontera entre SQLite y JavaScript.
  ↳ filaAObjeto, objetoAColumnas, COLUMNAS_COMUNES, TABLAS, NOMBRES, existeTabla

**`api/herramientas/`**

- `datos-ejemplo.mjs` — El evento de prueba «Ballenita 2026», en un fichero aparte para que también lo puedan usar las pruebas: así se garantiza que estos datos siguen entrando en el esquema real y saliendo íntegr…
  ↳ instantaneaDeEjemplo
- `sembrar-ejemplo.mjs` — Siembra la base con el evento de ejemplo «Ballenita 2026», para poder probar la app con datos antes de que entren los de verdad.

**`api/test/`**

- `d1.js` — Adaptador mínimo de D1 sobre `node:sqlite`, para poder probar el repositorio contra el esquema de verdad en lugar de contra un doble de mentira.
  ↳ baseDePrueba

**`app/scripts/`**

- `patch-ios.mjs` — Aplica automáticamente el fix del rebote (rubber-band) del scroll al proyecto iOS generado por Capacitor, para no tener que tocar Xcode a mano.

**`herramientas/`**

- `escaner.mjs` — Escáner léxico de JavaScript: separa el código de sus comentarios y literales.
  ↳ escanear, cabecera, prosa, primeraFrase, simbolosPublicos, literalDe · +2 más
- `mapa.mjs` — Compone el mapa del repositorio leyendo el código, no un resumen escrito a mano. 🐳

## Qué parte del spec implementa cada módulo

Leído de las citas que los comentarios del código hacen a `docs/SPECS.md`.

- **§2.2** Familias → `EventSettingsScreen.jsx`
- **§2.5** Ciclo de vida del evento (crear, duplicar, cerrar) → `EventsScreen.jsx`
- **§3** Gastos — "Modo Splitwise" 💸 → `reparto.js`
- **§3.1** Crear un gasto → `ExpensesScreen.jsx`
- **§3.2** Cómo se divide el gasto → `reparto.js`
- **§3.3** Splits predefinidos por familia (el requisito clave) ⭐ → `reparto.js`
- **§3.4** Saldos y liquidación → `BalancesScreen.jsx`, `reparto.js`
- **§3.6** Multi-moneda (decidido, con letra pequeña) → `money.js`
- **§4** Planes 🗺️ → `PlanesScreen.jsx`, `db.js`
- **§4.1** Agenda por días (vista que une todo) ⭐ → `AgendaScreen.jsx`
- **§5.1** Modelo de cuentas y pertenencia (aclarado) ⭐ → `EventSettingsScreen.jsx`
- **§6** Cenas 🍳 → `CenasScreen.jsx`, `db.js`
- **§6.2** Platos predefinidos → `db.js`
- **§6.4** Bungas en las comidas — rotación diaria mayores / niños ⭐ → `CenasScreen.jsx`, `stats.js`
- **§6.6** Lista de la compra compartida (manual) 🛒 ⭐ → `CenasCompraScreen.jsx`, `CompraScreen.jsx`, `db.js`
- **§7** Estadísticas 📊 → `StatsScreen.jsx`, `stats.js`
- **§12.2** Offline-first ⭐ → `ids.js`
- **§14** Arquitectura técnica (PWA) → `CompraScreen.jsx`, `PlanesScreen.jsx`, `db.js`, `ids.js`
- **§14.3** ⚠️ Safari iOS — confirmado por counter-ops → `engine.js`
- **§14.7** ✅ Veredicto de viabilidad — ¿aguanta el modelo de counter-ops? → `reparto.js`
- **§14.9** ⚠️ Migración a backend propio (Worker + D1) — **sustituye a 14.2, 14.5-bis y 14.5-ter** → `avatares.js`

## En curso

<!-- lo único a mano: se copia de CLAUDE.md -->

Lo único que se escribe **a mano** porque no se deduce del código. El hook lo inyecta
al final del mapa. Corto y en presente; el backlog va al [`README`](README.md).

- **Sin probar: entrar con Apple.** Los identificadores están de alta pero **nadie ha
  entrado aún** desde la app de iOS. Es el único eslabón que no se ha visto funcionar
  (token de Apple → `/api/sesion` → sesión → sync), y donde se concentran los fallos de
  configuración. El resto del despliegue está confirmado.
- **Decisión abierta — `/api/importar` y su token.** La siembra desde JSONBin se descartó y
  su herramienta ya no está, pero la ruta **no quedó huérfana**: la usa
  `npm run sembrar:ejemplo`. Por ahora se queda declarada como vía de importación genérica
  (sembrar pruebas, restaurar un volcado). Lo que falta por decidir es si sembrar datos de
  prueba en la base de producción justifica tener viva una ruta que puede sobrescribirla
  entera con un secreto registrado. Si la respuesta es no, se van las tres cosas juntas
  —ruta, token y `sembrar-ejemplo.mjs`— y el ejemplo se queda solo en local
  (`seedExample()` de `db.js`, que no toca el servidor).
