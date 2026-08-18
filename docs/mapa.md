# Mapa de Ballena Ops 🐳

<!-- GENERADO por herramientas/mapa.mjs leyendo el código. NO se edita a mano. -->
Dónde mirar sin leerse la aplicación entera. Si algo falta aquí, falta en el código.

## ✅ Sin desfases

Cada hecho declarado dos veces coincide con su gemelo.

## Las dos piezas

- **`app/`** v0.66.0 — PWA para gestionar los eventos del grupo de amigos — gastos estilo Splitwise entre familias, offline-first. 🐳
  1130 pruebas en 117 ficheros · `npm test` → `vitest run`
- **`api/`** v1.0.0 — API de Ballena Ops sobre Cloudflare Workers y D1 🐳
  264 pruebas en 25 ficheros · `npm test` → `node --test 'test/*.test.js'`

## Rutas que sirve el Worker

De la tabla `RUTAS` de `api/src/index.js`; la descripción, de la lista de su cabecera.
`exige`: `sesión` = llama a `cuentaAutenticada` · `servicio` = comprueba `TOKEN_SERVICIO`.

| | ruta | exige | qué hace |
| --- | --- | --- | --- |
| `GET` | `/api/salud` | — | comprobación sin autenticar |
| `POST` | `/api/sesion` | — | canjea un token de Apple por una sesión propia |
| `POST` | `/api/sesion/espera` | — | «¿ya me han dejado entrar?», con el pase y sin Apple |
| `POST` | `/api/sesion/enlace` | — | canjea el pase de un enlace de acceso, para quien no tiene iPhone |
| `GET` | `/api/sync` | sesión | instantánea completa del grupo |
| `POST` | `/api/cambios` | sesión | aplica la cola del dispositivo y devuelve la instantánea |
| `GET` | `/api/cuentas` | sesión | quién tiene acceso (administradores) |
| `POST` | `/api/cuentas` | sesión | enlazar con persona, eliminar, activar, renombrar y generar enlace (administradores) |
| `POST` | `/api/cuenta/baja` | sesión | eliminar la cuenta propia (directriz 5.1.1(v) de Apple) |
| `POST` | `/api/push` | sesión | apunta el token de APNs de este aparato, o lo silencia |
| `POST` | `/api/push/prueba` | sesión | se manda un aviso a sí mismo, y cuenta qué pasó |
| `GET` | `/api/avisos` | sesión | de qué quiere enterarse esta cuenta |
| `POST` | `/api/avisos` | sesión | lo cambia |
| `GET` | `/api/ia` | sesión | qué clave y qué modelo hay puestos (administradores) |
| `POST` | `/api/ia` | sesión | los cambia (administradores) |
| `GET` | `/api/ia/modelos` | sesión | los modelos que ofrece Anthropic hoy (administradores) |
| `POST` | `/api/ia/probar` | sesión | prueba el par clave+modelo con una llamada de verdad (administradores) |
| `POST` | `/api/plan/sugerir` | sesión | una tanda de ideas de plan (IA) |
| `POST` | `/api/plato/cantidades` | sesión | pone cantidades a los ingredientes de un plato (IA) |
| `POST` | `/api/plato/arreglar` | sesión | ordena a saco una lista de ingredientes escrita a mano (IA) |
| `POST` | `/api/plato/parecidos` | sesión | cinco platos enteros que se le parecen (IA) |
| `POST` | `/api/idea/mejorar` | sesión | la misma idea, mejor contada por el modelo (IA) |
| `POST` | `/api/estados/sugerir` | sesión | cinco estados para ponerse, del día que va el viaje (IA) |
| `POST` | `/api/estados/gracia` | sesión | el estado que has escrito, con más gracia (IA) |
| `POST` | `/api/bunga/resumen` | sesión | cómo es el bunga, en una o dos frases (IA) |
| `POST` | `/api/bunga/comentario` | sesión | un comentario para su hilo, a partir de cómo es (IA) |
| `POST` | `/api/recados` | sesión | una tanda de frases para el final de la lista (IA) |
| `POST` | `/api/importar` | servicio | siembra la base desde un volcado de JSONBin (servicio) |
| `GET` | `/api/mejoras` | servicio | las mejoras pendientes, para quien hace el trabajo (servicio) |
| `GET` | `/api/migraciones` | sesión | qué migraciones conoce el código y cuáles le faltan a la base (administradores) |
| `POST` | `/api/migraciones` | sesión | aplica la siguiente pendiente (administradores) |

## Barra de la PWA

**Agenda** (`agenda`) · **Dinero** (`dinero`) · **Comidas** (`comidas`) · **Planes** (`planes`) · **Grupo** (`grupo`)

## Tablas

- **Se sincronizan** (17, declaradas y contrastadas en `sync/tables.js`, `api/src/tablas.js`, la migración de D1 y Dexie): `events`, `families`, `bungas`, `persons`, `expenses`, `settlements`, `dishes`, `dinners`, `planIdeas`, `plans`, `shop`, `mejoras`, `registro`, `trucos`, `comentarios`, `alojamientos`, `cacharros`
- **Solo del servidor**: `cuenta`, `dispositivo`, `configuracion`
- **Solo locales** (no salen del móvil): `outbox`

## Configuración que el código consulta de verdad

**Worker** (`env.*` leídas en `api/src`):

- `APNS_CLAVE_ID` — no declarada en `wrangler.toml` (secreto u opcional)
- `APNS_CLAVE_P8` — no declarada en `wrangler.toml` (secreto u opcional)
- `APNS_ENTORNO` — `[vars]` = "produccion"
- `APNS_TOPICO` — no declarada en `wrangler.toml` (secreto u opcional)
- `APPLE_AUD_IOS` — `[vars]` = "com.garciadoral.ballenitaops"
- `APPLE_AUD_WEB` — no declarada en `wrangler.toml` (secreto u opcional)
- `APPLE_CLAVE_ID` — no declarada en `wrangler.toml` (secreto u opcional)
- `APPLE_CLAVE_P8` — no declarada en `wrangler.toml` (secreto u opcional)
- `APPLE_EQUIPO` — no declarada en `wrangler.toml` (secreto u opcional)
- `DB` — binding de D1 (`wrangler.toml`)
- `ORIGENES_PERMITIDOS` — `[vars]` = "https://ballenita-ops.galoopa.store,http://localhost:5173"
- `SESION_SECRETO` — no declarada en `wrangler.toml` (secreto u opcional)
- `TOKEN_SERVICIO` — no declarada en `wrangler.toml` (secreto u opcional)

**PWA** (`app/public/config.json`, leído al arrancar): `api`, `web`, `otaManifiesto`

## Automatizaciones

- **desplegar api** `.github/workflows/desplegar-api.yml`
  cuando: push (branches [main]) · workflow_dispatch
  corre: `npm ci`, `npm test`, `npx wrangler deploy`
- **Publish OTA bundle** `.github/workflows/ota.yml`
  cuando: workflow_dispatch · push (branches [main])
  corre: `npm ci`, `npm test`, `npm run build:app` (+4 guiones de varias líneas)
- **pruebas** `.github/workflows/pruebas.yml`
  cuando: push (branches ['**']) · pull_request · workflow_dispatch
  corre: `npm ci`, `npm test`, `npm run build`, `node --test 'herramientas/*.test.mjs'`, `node herramientas/mapa.mjs --verificar`

Nada corre por horario: ningún `schedule:` en los flujos ni handler `scheduled` en el Worker.

## Módulos

Primera frase de la cabecera de cada módulo.

**`app/src/`**

- `App.jsx` — El esqueleto de la aplicación: cabecera, cuerpo y barra de cinco destinos.
- `db.js` — IndexedDB desde el día 1 (§14).
- `main.jsx` — El arranque: monta React en el DOM y pone el tema y el tamaño de letra antes del primer pintado, para que la app no aparezca con la cara equivocada.

**`app/src/auth/`**

- `apple.js` — Acceso con Sign in with Apple — **solo dentro de la app de iOS**.
- `enlace.js` — El enlace de acceso, del lado del navegador (SPECS §14.61).
- `espera.js` — La sala de espera, del lado del móvil.
- `sesion.js` — La sesión de este dispositivo: el token que firmó el Worker y a quién corresponde.

**`app/src/components/`**

- `Acordeon.jsx` — Un apartado plegable, con `<details>` y `<summary>` del propio navegador.
- `Alias.jsx` — El alias de una familia, en pastilla y con su color (`docs/diseño/planes-ideas.html` · B3).
- `AvisoDeAvisos.jsx` — El recordatorio de los avisos, en «Hoy» (SPECS §14.65).
- `BotonDePerfil.jsx` — Emojis rápidos para el avatar (también se escribe a mano).
- `BotonIA.jsx` — Un botón que le pregunta algo al modelo, y **dice que está pensando**.
- `Campo.jsx` — Un campo: su rótulo, el control, y **debajo la línea que lo explica**.
- `Comentarios.jsx` — El hilo de cualquier cosa, enchufable donde haga falta (SPECS §14.55).
- `Confirmar.jsx` — La pregunta antes de borrar, en su sitio y diciendo qué se lleva.
- `Deslizable.jsx` — Una fila que se desliza a la izquierda para descubrir sus verbos.
- `Fab.jsx` — El botón de crear, con la palabra puesta.
- `Hoja.jsx` — Una hoja que sube desde el borde de abajo (`docs/diseño/gente-editar.html · F2`).
- `HojaDeEstado.jsx` — Tu estado, en una capa centrada (`docs/diseño/estado.html` · M2 · I1 · I3).
- `Icono.jsx` — Los dibujos de la app, en una sola tabla.
- `Ingredientes.jsx` — Los ingredientes de una receta: **una lista sin cajas y un renglón al pie**.
- `LineaDelHorizonte.jsx` — La línea del horizonte: tres puntos bajo la cabecera que son el día.
- `ListaDePlatos.jsx` — Los platos de una cena, **en el orden en que se comen y diciendo de qué es cada uno** (`docs/diseño/hoy-el-dia.html` · L2).
- `PadDeImporte.jsx` — La cifra grande y el pad de dieciséis teclas (`docs/diseño/gasto-nuevo.html` · A1, SPECS §14.26).
- `PastillaDeEstado.jsx` — Tu estado, en la segunda línea de la cabecera (`docs/diseño/estado.html` · A3 · V1).
- `PieDeVersion.jsx` — La versión que hay puesta, al final del scroll, y el botón de actualizar.
- `ProgresoModal.jsx` — Lo que está pasando, contado de arriba abajo, mientras dura un proceso largo.
- `Recado.jsx` — Un emoji y una frase, al final de la lista.
- `SubNav.jsx` — Control segmentado que vive bajo la cabecera, dentro de una pestaña, para dividir una sección en dos (p. ej. Dinero → Gastos / Saldos).
- `SyncDot.jsx` — Punto de estado de la sincronización: color + ayuda + si conviene animar.
- `WhaleLogo.jsx` — La marca: **el icono de la app**, el mismo que se toca en la pantalla de inicio.

**`app/src/lib/`**

- `admin.js` — Quién manda aquí, y por qué está escrito a mano.
- `alias.js` — El alias de una familia: **dos letras**.
- `alojamientos.js` — El bunga como **sitio** y no como fila de un evento (SPECS §14.56, `docs/diseño/siete-encargos.html` · B2 · B4 · B5).
- `areas.js` — El área elegida dentro de una sección, que no se olvida al salir y volver.
- `asignacion.js` — Quién se queda con qué bunga: el emparejamiento familia ↔ bunga.
- `avatares.js` — Foto de avatar de una persona.
- `avisos.js` — Lo que está esperando a que alguien haga algo.
- `borrados.js` — Qué se lleva por delante un borrado, dicho en una frase.
- `cacharros.js` — El ranking de cacharros: quién gana, quién puede votar y qué se dice de él (SPECS §14.57, `docs/diseño/siete-encargos.html` · G1·G2·G3·G4).
- `carta.js` — El orden de la carta: qué categorías hay y en qué orden se sirven.
- `categorias.js` — Las cinco categorías de un gasto.
- `cielo.js` — De qué color está el cielo a esta hora.
- `cocina.js` — Con qué se cocina, tal como lo cuenta la pantalla (SPECS §14.20-quater).
- `comentarios.js` — Los comentarios: de quién es un hilo, qué hay sin leer y a quién avisa (SPECS §14.55, `docs/diseño/donde-vive-el-grupo.html` · K2 · K4 · K6).
- `compra-familias.js` — Cómo se agrupa la lista de la compra cuando cada familia tiene la suya (SPECS §14.54, `docs/diseño/siete-encargos.html` · C1 · C2).
- `compra.js` — De las cenas a la lista de la compra, pasando por las dos mesas.
- `config.js` — Configuración del despliegue, leída **en caliente** de `config.json`.
- `demo.js` — Modo de demostración: la app entera, con datos inventados y sin servidor.
- `destino.js` — A dónde lleva tocar un aviso (SPECS §14.60, `docs/diseño/donde-vive-el-grupo.html` · R2 · R3 · R4).
- `dias.js` — Los días de un evento, y qué se hace en cada uno.
- `emojis.js` — Contar y cortar emoji **por dibujos**, y no por unidades de texto (SPECS §14.47).
- `estados.js` — Un estado es **un emoji y una frase corta**: «🍺 de resaca».
- `evento.js` — Qué se cae fuera al cambiar las fechas de un evento.
- `fechas.js` — Las dos reglas de un par de fechas «desde – hasta».
- `hace.js` — Cuánto hace, escrito en palabras.
- `ia.js` — ¿Se le puede preguntar algo al modelo **ahora mismo**?
- `identidad.js` — Quién eres en un evento.
- `ids.js` — IDs generados en cliente (§12.2): así dos dispositivos offline no chocan al sincronizar.
- `importe.js` — La máquina de teclear un importe (SPECS §14.26, `docs/diseño/gasto-nuevo.html` · A1).
- `money.js` — Todo el dinero se maneja en CÉNTIMOS enteros para no arrastrar errores de coma flotante.
- `native.js` — Puente con las capacidades nativas (Capacitor).
- `notas.js` — Qué cambió cada versión publicada, en el idioma del grupo — la prosa de las tarjetas de Ajustes → 🐳 La app (SPECS §14.34, figura de `meeting-ops-air`).
- `permisos.js` — Quién puede tocar qué del grupo (SPECS §14.63).
- `personas.js` — Lo que hace falta saber de una persona, sin React de por medio.
- `planes.js` — Lo que se dice de un plan sin abrirlo: cuántos lo quieren y quién falta.
- `primeraBajada.js` — La primera bajada: traer lo del grupo justo después de entrar por primera vez.
- `push.js` — Que el servidor sepa a qué aparato mandar, sin que nadie lo pida.
- `pwa.js` — Fuerza que la PWA cargue la última versión desplegada sin tener que quitar y volver a añadir a la pantalla de inicio.
- `recados.js` — Los recados: un emoji y una frase, sacados de lo que está pasando en el viaje.
- `recap.js` — El recap del viaje, sacado del registro (SPECS §14.50).
- `receta.js` — Una receta con cantidades, y cómo se estira para la gente que hay.
- `recordatorioDeAvisos.js` — Volver a acordarse de los avisos, cada tanto (SPECS §14.65).
- `registro.js` — La bitácora del viaje: qué ha hecho cada uno, para el recap del final.
- `reparto-gente.js` — Entre quién se divide un gasto: los atajos, las familias y el buscador.
- `reparto-vista.js` — Cómo se cuenta el reparto de un gasto en pantalla, sin pintar nada.
- `reparto.js` — Motor de reparto — el corazón de Ballena Ops (§3, §14.7 del spec).
- `salida.js` — Salir de la cuenta sin llevarse por delante lo que todavía no ha subido.
- `scrollLock.js` — Bloqueo del scroll del fondo mientras hay un modal abierto.
- `sincronizarTodo.js` — Inyectada por Vite.
- `sol.js` — A qué hora sale y se pone el sol, y en qué punto del día estamos.
- `stats.js` — Estadísticas del evento (§7).
- `tamano.js` — Tamaño del texto, por dispositivo.
- `tanda.js` — Cuándo se pide la tanda de recadillos, y dónde se guarda mientras tanto.
- `tema.js` — El tema, que ahora es **uno solo** con sus dos caras.
- `vigilante.js` — Quién vigila si ha salido versión nueva mientras la app está abierta (SPECS §14.46).

**`app/src/screens/`**

- `AccesoScreen.jsx` — Puerta de entrada al grupo.
- `AgendaScreen.jsx` — «Agenda», partida en tres áreas (opciones A1 y B2 de `docs/diseño/navegacion.html`; la tercera llegó después, desde Ajustes).
- `BalancesScreen.jsx` — Saldos: cuánto debe cada familia y quién paga a quién.
- `BienvenidaScreen.jsx` — Lo que se ve la primera vez que entras, mientras baja lo del grupo.
- `CacharrosSection.jsx` — El cacharro del año: uno por familia, y se vota el mejor (SPECS §14.57).
- `ComidasScreen.jsx` — «Comidas», con dos áreas: **la Carta y la Compra** (`docs/diseño/cenas-fuera-y-reparto.html` · N1).
- `CompraScreen.jsx` — La lista de la compra: lo que sale de las recetas y lo que se apunta a mano.
- `CuentasSection.jsx` — Las cuentas que han pedido entrar, y con quién es cada una.
- `DiasScreen.jsx` — «Días»: la lista de días del evento, con un resumen de cada uno.
- `DineroScreen.jsx` — «Dinero» une las dos caras de lo económico: metes el gasto y ves quién debe a quién sin cambiar de pestaña.
- `EnlaceScreen.jsx` — Lo que se ve mientras un enlace de acceso se canjea, y cuando no puede (SPECS §14.61).
- `EventSettingsScreen.jsx` — Lo que la lista terminada se queda en pantalla antes de recargar, para poder leerla.
- `EventsScreen.jsx` — La lista de eventos: cuál está activo, y crear o editar uno.
- `ExpensesScreen.jsx` — «19:40» — desempata dos gastos de la misma categoría el mismo día.
- `FichaDeGasto.jsx` — La ficha de un gasto (SPECS §14.26 · `docs/diseño/gasto-nuevo.html`, combinación A1 · B3 · C1 · D2 · E2).
- `GrupoScreen.jsx` — Grupo: quién viene, dónde duerme cada familia y qué gadget ha traído.
- `GrupoSection.jsx` — El grupo en una sola sección: una ficha por familia, con su bunga y su gente.
- `HojaDeEntre.jsx` — Entre quién se divide (SPECS §14.27 · `docs/diseño/gasto-entre.html`, combinación A3 · B2 · C2 con el renglón de C4 · D2 + D4, y E1 en vez de E2).
- `HoyScreen.jsx` — «Hoy»: qué pasa hoy, contestado sin que haya que leer.
- `IdeasScreen.jsx` — «Ideas»: lo que se repite de un viaje a otro.
- `MejorasSection.jsx` — «Mejoras»: el roadmap de la app, apuntado desde el móvil.
- `PlanesConAreasScreen.jsx` — «Planes», partido en dos áreas: lo de este viaje y el catálogo.
- `PlanesScreen.jsx` — Planes: lo que se propone para este viaje, y a qué se apunta cada uno.
- `PlatosScreen.jsx` — «Platos»: el catálogo, que hasta ahora no tenía pantalla.
- `StatsScreen.jsx` — Estadísticas del evento: el gasto, las cenas y los planes, contados.
- `TrucosScreen.jsx` — Trucos: lo que hay que acordarse de un viaje a otro (SPECS §14.53).

**`app/src/sync/`**

- `api.js` — Transporte contra la API propia (Worker + D1).
- `engine.js` — El orquestador de la sincronización: cuándo se sube la cola y se baja la instantánea.
- `tables.js` — Tablas que se sincronizan (todo lo que es "hecho" del grupo).

**`api/src/`**

- `administrador.js` — Quién administra, y cómo se le reconoce sin que nadie le abra la puerta.
- `apns.js` — El transporte hasta el teléfono: APNs con autenticación por token.
- `apple.js` — Verificación del token de identidad de Sign in with Apple.
- `avisos.js` — A quién le importa lo que acaba de pasar, y qué se le dice.
- `bunga.js` — El bunga, evaluado en dos frases (SPECS §14.66, §14.66-ter).
- `cantidades.js` — Cuánto de cada ingrediente, y en qué se compra.
- `cocina.js` — Con qué se cocina en este viaje (SPECS §14.20-quater).
- `encargos.js` — Lo que se le pide al modelo, en un sitio y por escrito.
- `estados.js` — Los estados de una persona: «🍺 de resaca», «🏖️ tirado en la toalla».
- `ia.js` — Los dos servicios de la pantalla de IA: **qué modelos hay** y **si la clave vale**.
- `idea.js` — El encargo del botón «Mejorarla» del editor de una idea (SPECS §14.24).
- `index.js` — API de Ballena Ops sobre Cloudflare Workers y D1. 🐳
- `migraciones.js` — Generado por `herramientas/generar-migraciones.mjs` — no editar a mano.
- `migrador.js` — Poner la base al día desde el propio Worker (SPECS §14.23).
- `recados.js` — Una tanda de recados para el viaje: un emoji y una frase corta, con gracia.
- `receta.js` — Los dos encargos del editor de una receta (SPECS §14.20-bis).
- `repositorio.js` — Lectura y escritura del registro del grupo sobre D1.
- `revocacion.js` — Revocación del token de Sign in with Apple al darse de baja.
- `sesion.js` — Sesión propia: un JWT HS256 corto que el dispositivo presenta en cada petición.
- `sugerencias.js` — Cinco planes propuestos para un viaje.
- `tablas.js` — Descripción de las tablas sincronizadas: qué columnas tiene cada una y cuáles necesitan conversión al cruzar la frontera entre SQLite y JavaScript.

**`api/herramientas/`**

- `datos-ejemplo.mjs` — El evento de prueba «Ballenita 2026», en un fichero aparte para que también lo puedan usar las pruebas: así se garantiza que estos datos siguen entrando en el esquema real y saliendo íntegr…
- `generar-migraciones.mjs` — Copia las migraciones de `migraciones/*.sql` a `src/migraciones.js`, para que el Worker las lleve dentro.
- `sembrar-desde-jsonbin.mjs` — Trae el documento que el grupo tiene en JSONBin y lo siembra en la base nueva.
- `sembrar-ejemplo.mjs` — Siembra la base con el evento de ejemplo «Ballenita 2026», para poder probar la app con datos antes de que entren los de verdad.

**`api/test/`**

- `d1.js` — Adaptador mínimo de D1 sobre `node:sqlite`, para poder probar el repositorio contra el esquema de verdad en lugar de contra un doble de mentira.

**`app/scripts/`**

- `appdelegate.mjs` — El puente entre APNs y el plugin de avisos, que vive en `AppDelegate.swift`.
- `entitlements.mjs` — El permiso de avisos del binario, que son **dos** cosas y no una.
- `iconos-web.mjs` — Los iconos de la web y de la PWA, sacados de `assets/icon.png`.
- `patch-ios.mjs` — Aplica al proyecto iOS generado por Capacitor lo que no cabe en la web: el fix del rebote (rubber-band) del scroll, la declaración de que esto es una app de iPhone, el cumplimiento de expor…
- `revision-de-avisos.mjs` — Lo que tiene que estar puesto en el binario para que los avisos existan, leído **después** de haberlo escrito.

**`herramientas/`**

- `escaner.mjs` — Escáner léxico de JavaScript: separa el código de sus comentarios y literales.
- `mapa.mjs` — Compone el mapa del repositorio leyendo el código, no un resumen escrito a mano. 🐳

## Qué parte del spec implementa cada módulo

Leído de las citas que los comentarios del código hacen a `docs/SPECS.md`.

- **§3** Gastos — "Modo Splitwise" 💸 → `reparto.js`
- **§3.2** Cómo se divide el gasto → `reparto.js`
- **§3.3** Splits predefinidos por familia (el requisito clave) ⭐ → `BalancesScreen.jsx`, `reparto-vista.js`, `reparto.js`
- **§3.4** Saldos y liquidación → `reparto.js`
- **§3.6** Multi-moneda (decidido, con letra pequeña) → `money.js`
- **§4** Planes 🗺️ → `db.js`
- **§6** Cenas 🍳 → `db.js`
- **§6.2** Platos predefinidos → `db.js`
- **§6.4** Bungas en las comidas — rotación diaria mayores / niños ⭐ → `stats.js`
- **§6.6** Lista de la compra compartida (manual) 🛒 ⭐ → `compra-familias.js`, `db.js`
- **§7** Estadísticas 📊 → `StatsScreen.jsx`, `recap.js`, `stats.js`
- **§12.2** Offline-first ⭐ → `ids.js`
- **§14** Arquitectura técnica (PWA) → `db.js`, `ids.js`
- **§14.3** ⚠️ Safari iOS — confirmado por counter-ops → `engine.js`
- **§14.7** ✅ Veredicto de viabilidad — ¿aguanta el modelo de counter-ops? → `reparto.js`
- **§14.9** ⚠️ Migración a backend propio (Worker + D1) — **sustituye a 14.2, 14.5-bis y 14.5-ter** → `BienvenidaScreen.jsx`, `CuentasSection.jsx`, `EventSettingsScreen.jsx`, `MejorasSection.jsx`, `ProgresoModal.jsx`, `api.js` · +11 más
- **§14.10** Cromo de la app: cabecera, barra inferior y modales → `App.jsx`, `ComidasScreen.jsx`, `DiasScreen.jsx`, `EventSettingsScreen.jsx`, `PlanesScreen.jsx`, `alojamientos.js` · +2 más
- **§14.11** Tipografía: un número y toda la escala → `BalancesScreen.jsx`
- **§14.13** Los dibujos, y el único color que informa → `StatsScreen.jsx`, `categorias.js`, `personas.js`, `pwa.js`
- **§14.14** El grupo: una ficha por familia, y la hoja que sube desde abajo → `Confirmar.jsx`, `EventSettingsScreen.jsx`, `GrupoSection.jsx`, `PlatosScreen.jsx`, `borrados.js`, `evento.js` · +1 más
- **§14.15** Quién entra: la sala de espera, las cuentas y los avisos → `index.js`
- **§14.16** La IA: la clave vive en el servidor → `api.js`, `cocina.js`, `encargos.js`, `ia.js`, `index.js`, `receta.js` · +1 más
- **§14.17** Avisos al móvil: APNs directo, sin SDK de nadie → `recordatorioDeAvisos.js`
- **§14.18** El día es el de aquí, no el de Greenwich → `db.js`, `planes.js`
- **§14.19** La versión, abajo y tocable → `ExpensesScreen.jsx`, `GrupoSection.jsx`, `IdeasScreen.jsx`, `MejorasSection.jsx`, `PlanesScreen.jsx`, `PlatosScreen.jsx` · +10 más
- **§14.20** Recetas con cantidades, y la compra que sale de ellas → `CompraScreen.jsx`, `EventSettingsScreen.jsx`, `PlatosScreen.jsx`, `api.js`, `borrados.js`, `cocina.js` · +6 más
- **§14.21** El día del viaje: qué bungas, qué se cena y qué plan → `db.js`
- **§14.22** Mejoras: el roadmap de la app, apuntado desde el móvil → `Icono.jsx`, `db.js`, `index.js`, `repositorio.js`, `tablas.js`
- **§14.23** Poner la base al día desde Ajustes, cuando va por detrás del código → `EventSettingsScreen.jsx`, `api.js`, `index.js`, `migraciones.js`, `migrador.js`, `repositorio.js`
- **§14.24** El editor de una idea: centrado, sin teclado encima, y con «Mejorarla» → `DiasScreen.jsx`, `FichaDeGasto.jsx`, `IdeasScreen.jsx`, `api.js`, `idea.js`, `index.js`
- **§14.25** Que se note que es verano: el sol de la cabecera y los recados → `App.jsx`, `api.js`, `index.js`, `repositorio.js`
- **§14.26** Apuntar un gasto en la puerta del súper: sin teclado, y con la cuenta hecha → `FichaDeGasto.jsx`, `HojaDeEntre.jsx`, `PadDeImporte.jsx`, `avisos.js`, `borrados.js`, `comentarios.js` · +5 más
- **§14.27** Entre quién se divide: cuatro atajos, las familias, y salir sin guardar → `Confirmar.jsx`, `DiasScreen.jsx`, `HojaDeEntre.jsx`, `Icono.jsx`, `reparto-gente.js`
- **§14.28** El mapa del repositorio, compuesto leyendo el código → `native.js`
- **§14.29** La puerta, la sala de espera y el primer arranque tras ser aceptado → `AccesoScreen.jsx`, `App.jsx`, `EnlaceScreen.jsx`
- **§14.30** El día abierto: el mueble de un plan, y cada toque escribe → `DiasScreen.jsx`, `HoyScreen.jsx`
- **§14.31** Los elegidores del día: al centro, con borrador y buscador → `BotonDePerfil.jsx`, `DiasScreen.jsx`, `HojaDeEstado.jsx`, `StatsScreen.jsx`, `stats.js`
- **§14.32** El semáforo del día, y el género del bunga → `PlanesScreen.jsx`
- **§14.34** Cada versión se describe a sí misma → `EventSettingsScreen.jsx`, `notas.js`
- **§14.36** Tu estado, en la cabecera → `HoyScreen.jsx`, `PastillaDeEstado.jsx`, `api.js`, `db.js`, `estados.js`, `index.js`
- **§14.37** La marca es el icono, y el rojo se reserva para lo que falla → `EventSettingsScreen.jsx`
- **§14.38** Borrar pregunta, y la pregunta dice qué se lleva → `DiasScreen.jsx`
- **§14.39** De qué avisarte, y no avisarte de lo tuyo → `CuentasSection.jsx`, `api.js`, `avisos.js`, `index.js`
- **§14.41** Quién puede tocar qué: la cuenta siembra la identidad, y los cerrojos → `BalancesScreen.jsx`, `DiasScreen.jsx`, `EventSettingsScreen.jsx`, `ExpensesScreen.jsx`, `GrupoSection.jsx`, `db.js` · +5 más
- **§14.42** Con sesión, quién eres lo dice la cuenta y no se elige → `BotonDePerfil.jsx`, `EventSettingsScreen.jsx`, `identidad.js`
- **§14.43** Organizar el viaje es de los adultos, y el evento de quien administra → `DiasScreen.jsx`, `EventSettingsScreen.jsx`, `IdeasScreen.jsx`, `PlanesScreen.jsx`, `personas.js`
- **§14.44** Los estados, uno debajo de otro; el recado, bajo el selector → `CompraScreen.jsx`, `ExpensesScreen.jsx`, `HoyScreen.jsx`, `PlatosScreen.jsx`
- **§14.45** Quien administra sí cambia de persona, y «Hoy» invita a decir tu estado → `HoyScreen.jsx`, `db.js`, `identidad.js`
- **§14.46** Al minuto: los datos se traen y la versión se vigila → `App.jsx`, `engine.js`, `native.js`, `vigilante.js`
- **§14.47** Pulsar Agenda lleva al calendario, y en un emoji caben tres → `App.jsx`, `BotonDePerfil.jsx`, `areas.js`, `emojis.js`
- **§14.48** Un bunga con familia también se corrige → `GrupoSection.jsx`, `Hoja.jsx`
- **§14.49** «Mayores» son los mayores, y «Peques» se retira → `db.js`, `personas.js`, `reparto-gente.js`
- **§14.50** Lo que hace el grupo se apunta, y al final se cuenta → `CacharrosSection.jsx`, `Comentarios.jsx`, `StatsScreen.jsx`, `db.js`, `recap.js`, `registro.js` · +1 más
- **§14.51** Un pago apuntado se puede deshacer → `borrados.js`
- **§14.52** El grupo dejó de ser un ajuste, y Ajustes sube a un botón → `App.jsx`, `EventSettingsScreen.jsx`, `GrupoScreen.jsx`, `db.js`, `repositorio.js`, `tables.js`
- **§14.53** Los trucos: lo que hay que acordarse de un viaje a otro → `PlanesConAreasScreen.jsx`, `TrucosScreen.jsx`, `db.js`, `tablas.js`
- **§14.54** La compra, por familia → `CompraScreen.jsx`, `compra-familias.js`, `db.js`, `tablas.js`
- **§14.55** Los comentarios: una tabla con ancla, y un componente → `BotonDePerfil.jsx`, `Comentarios.jsx`, `DiasScreen.jsx`, `FichaDeGasto.jsx`, `GrupoSection.jsx`, `Hoja.jsx` · +6 más
- **§14.56** El bunga es un sitio, y por eso puede tener historia → `GrupoSection.jsx`, `PlatosScreen.jsx`, `alojamientos.js`, `db.js`, `permisos.js`, `tablas.js`
- **§14.57** El cacharro del año → `CacharrosSection.jsx`, `cacharros.js`, `db.js`, `permisos.js`, `tablas.js`
- **§14.58** Quién lleva las cuentas → `GrupoSection.jsx`, `avisos.js`, `db.js`, `index.js`, `tablas.js`, `tables.js`
- **§14.59** Hay cosas que no se someten a votación → `Hoja.jsx`, `IdeasScreen.jsx`, `PlanesScreen.jsx`, `db.js`, `planes.js`
- **§14.60** El aviso abre lo que lo generó → `App.jsx`, `DiasScreen.jsx`, `ExpensesScreen.jsx`, `GrupoScreen.jsx`, `GrupoSection.jsx`, `PlanesScreen.jsx` · +5 más
- **§14.61** El enlace deja de ser de un solo uso → `App.jsx`, `CuentasSection.jsx`, `EnlaceScreen.jsx`, `GrupoSection.jsx`, `api.js`, `enlace.js` · +3 más
- **§14.62** Tu perfil vive detrás de tu emoji, y «Quién eres» se retira → `App.jsx`, `BotonDePerfil.jsx`, `EventSettingsScreen.jsx`
- **§14.63** El grupo, en tres áreas y con tres niveles de permiso → `Acordeon.jsx`, `GrupoScreen.jsx`, `GrupoSection.jsx`, `permisos.js`
- **§14.64** Un plato dice qué lleva y ahora también cómo se hace → `PlatosScreen.jsx`, `db.js`, `tablas.js`
- **§14.65** Los avisos se recuerdan cada semana, y el bunga vuelve a su familia → `AvisoDeAvisos.jsx`, `EventSettingsScreen.jsx`, `GrupoSection.jsx`, `HoyScreen.jsx`, `recordatorioDeAvisos.js`
- **§14.66** El bunga se resume en una frase, se comenta, y la familia va en pastilla → `Comentarios.jsx`, `GrupoSection.jsx`, `alojamientos.js`, `api.js`, `avisos.js`, `bunga.js` · +3 más
- **§14.67** «Hoy» cuenta el día, y el día se puede mirar sin montarlo → `reparto-vista.js`
- **§14.68** Las cenas se montan en el día, y el gasto dice cómo se reparte → `DiasScreen.jsx`, `FichaDeGasto.jsx`, `areas.js`
- **§14.69** Un día dice lo que hay, en vez de contarlo → `DiasScreen.jsx`, `dias.js`
- **§14.70** O se cena fuera, o se reparten bungas — y el día se nombra en el aviso → `DiasScreen.jsx`, `avisos.js`, `compra.js`, `db.js`, `dias.js`, `stats.js` · +1 más
- **§14.71** En el día se ven todos los planes, uno por renglón → `DiasScreen.jsx`
