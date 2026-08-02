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
- **Cuando falla, se dice qué ha fallado** (SPECS §14.9-bis, figura de `garciadoral-ops`):
  el error lleva el **estado HTTP** (`sync/api.js`), lo que el servidor **rechaza** sale en
  la lista de pasos —la interfaz es optimista, callarlo se lee como que la app pierde
  cosas—, se guarda la **última correcta** (`ballena.sync.ultima`) y se enseña en palabras
  (`lib/hace.js`), y el renglón del fallo **se toca para copiar el informe**. En Ajustes el
  progreso se pinta en su sitio (`ListaDePasos`); el punto de la cabecera abre su modal.
- **Un plan es dos cosas** (SPECS §14.18, `docs/diseño/planes-catalogo.html` · A3·B3·C1): la
  **idea** que se repite (`planIdeas`, catálogo compartido como `dishes`) y la **propuesta de
  este año** (`plans`, con día, estado y votos). Traer una idea **copia**, no enlaza: el día,
  el estado y los votos no viajan nunca. Planes tiene ahora dos áreas, Planes · Ideas.
- **Lo que cae fuera de las fechas se aparta, no se esconde** (SPECS §14.10-quater,
  `lib/evento.js` · `porDia`): Cenas y Planes se ordenan por día y lo que ya no pertenece al
  evento baja al final marcado. Esconderlo lo dejaría invisible pero contando en Estadísticas
  y ocupando bunga.
- **El evento «Demo» es un cajón de arena** (SPECS §14.9-quater): cenas, planes, gastos y
  compra ya colgaban de su evento, pero `dishes` era un catálogo global y el Demo escribía
  ahí. Ahora un plato puede llevar `eventId` —sin él es de todos, con él es solo de ese
  evento—, y el Demo se reconoce por `events.esDemo`. `listDishes(evento)` y
  `addDish(campos, evento)` reciben el evento. En la API, dos columnas nuevas
  (`migraciones/0005_*.sql`, `npm run migrar:remoto5` si la base ya existía).
- **Salir de la cuenta sube la cola antes de borrar** (SPECS §14.9-ter, `lib/salida.js`):
  `olvidarTodo()` se lleva también el `outbox`, así que salir con cambios sin subir los
  perdía para siempre —se leía como «he vuelto a entrar y el evento ha desaparecido»—. Ahora
  se intenta subir; si no puede, **no borra**: dice cuántos y por qué, y salir es una segunda
  pulsación.
- **Toda escritura pasa por `escribir()`/`removeRow()` en `db.js`**, que guardan el dato y su
  entrada en la cola **en la misma transacción**. No escribas en `db.<tabla>` directamente:
  el cambio no subiría nunca.
- **Auth:** Sign in with Apple **solo en la app de iOS**; el Worker firma una sesión propia
  (JWT HS256, 90 días). Quien entra queda apuntado en una **sala de espera** y no entra hasta que
  el administrador **lo enlaza con una persona** (SPECS §14.18). Administrador hay **uno y escrito
  a mano** (`lib/admin.js`); la primera cuenta de una instalación vacía nace administradora.
- **La clave de la IA vive en el servidor** (tabla `configuracion`, SPECS §14.16) y no vuelve
  entera a ningún móvil: es una credencial de pago.
- **La web NO sincroniza**, a propósito: en navegador y PWA la app es una libreta local
  (`hayApi()` devuelve `false` si no es nativa). Ahorra todo el montaje web de Apple
  —Services ID, verificación de dominio— a cambio de exigir la app para participar.
- **Configuración en caliente:** `app/public/config.json` (API, cliente de Apple, manifiesto
  OTA). Se lee al arrancar, así que cambiarla **no** exige reconstruir ni publicar un OTA.
- **Offline-first**: iOS Safari no tiene background sync → se sincroniza en foreground
  (patrón de `counter-ops`). Requiere "Añadir a pantalla de inicio" para push/persistencia.
- **Tema** (`lib/tema.js`, SPECS §14.12): **uno solo**, Abisal Sobrio, con sus dos caras
  diseñadas por separado. En Ajustes solo se elige Automático · Claro · Oscuro. Los nueve
  skins y el modo aleatorio se retiraron.
- **Iconos** (`components/Icono.jsx`, SPECS §14.13): dibujo de línea sobre rejilla de 24,
  trazo 1,8, en una tabla única; heredan el color de quien los coloca. **Los emoji que
  elige el usuario se quedan** (avatar, estado); los del cromo, no. Las cinco categorías de
  gasto llevan tono propio porque informa — es el único color además del de los saldos.
- **Tipografía** (`lib/tamano.js`, SPECS §14.11): cuerpo a 17 px y **un solo número**
  (`--escala`) del que cuelga toda la escala `--t-*`. **De fábrica va en Grande**
  (×1,12); Ajustes → Aspecto la mueve (Normal/Grande/Enorme). **No pongas `fontSize`,
  `fontWeight` ni colores en un `style={{…}}`**: no pasan por la escala ni por el tema, y
  `src/estilos.test.js` te para en seco diciéndote qué usar. Los inline de fontanería
  (`marginTop`, `display`) no molestan y se quedan.
- **Esqueleto** (SPECS §14.10): `.app` es una columna de `100dvh` —cabecera · `.body`
  (`flex:1; min-height:0; overflow-y:auto`) · barra—. Nada es `position: fixed`, así que
  nada se solapa. No añadas relleno al final de `.body` para esquivar la barra.

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
        stats.js money.js ids.js native.js pwa.js
        tema.js tamano.js     aspecto: cara del tema y tamaño del texto (por dispositivo)
        identidad.js          quién eres en un evento (compartido cabecera ↔ Ajustes)
        asignacion.js         qué bungas y qué familias están libres (el 1 a 1)
        personas.js           pesos por edad (1 · 0,6) y los emoji para elegir
        evento.js             qué cenas y planes se caen al acortar las fechas
        fechas.js             el fin se propone solo y nunca va antes del inicio
        admin.js              quién administra (uno, escrito a mano) · avisos.js  lo pendiente
        sincronizarTodo.js    datos + versión de la app, en una lista de pasos
        salida.js             salir sin perder lo que no ha subido
        hace.js               «hoy a las 14:03», «hace 12 min» (de garciadoral-ops)
        scrollLock.js avatares.js
  auth/ apple.js        Sign in with Apple (web + iOS)    ·  sesion.js  token del dispositivo
  lib/  demo.js         demostración sin cuenta (directriz 2.1 de Apple)
  sync/ engine.js       orquestador (cuándo sincronizar)  ·  api.js  transporte
        tables.js
  lib/  dias.js               los días de un evento y qué se hace en cada uno (puro)
        areas.js              el área elegida en cada sección, que no se olvida al salir
  screens/  Agenda(Hoy·Días), Dinero(Gastos·Saldos), Comidas(Cenas·Platos·Compra),
            Planes(Planes·Ideas), Stats, EventSettings (= Ajustes, en acordeón),
            Grupo(familias+bungas+gente), Cuentas(+Notificaciones+IA), Events, Acceso
  components/ Acordeon.jsx · Deslizable.jsx · Fab.jsx · Hoja.jsx · Icono.jsx
              ProgresoModal.jsx · SyncDot.jsx · WhaleLogo.jsx
  App.jsx  ·  theme.css
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

- Rama de trabajo: **la que diga el encargo**; si no dice ninguna,
  `claude/basic-ui-review-e28ijl`. Si su PR ya está **fusionada**, reinicia la rama
  desde `main` (`git checkout -B <rama> origin/main`) y abre **PR nueva**; no apiles sobre
  historia ya fusionada.
- Commits descriptivos; **corre `npm test` antes de push**.
- **La PR se abre lista para revisar, no en borrador.** Decía lo contrario, y lo que hacía
  era pedir un clic de más para nada: un borrador anuncia que el trabajo todavía se está
  haciendo, y aquí una PR se abre cuando ya está hecho y lo único que falta es mirarla y
  fusionarla. Si alguna vez hace falta enseñar algo a medias, se pone en borrador esa y se
  dice por qué.

## Cómo se cuenta cada vuelta

Lo que dice la respuesta es lo único que hay hasta que la pantalla lo confirme, y una
pantalla que aún no lo confirma se ve igual que una donde no se hizo nada.

- **Al mergear, tres cosas y en este orden:** (1) **qué ha cambiado**, en lista o tabla,
  una línea por cambio y no un párrafo del que haya que sacarlos; (2) **qué versión tiene
  que estar puesta**, con el número y dónde mirarlo —**Ajustes → 🐳 La app**, que lleva la
  versión en el propio rótulo del acordeón y «Versión en curso» dentro; sale de
  `app/package.json` inyectada por Vite—; y (3) **qué puede quedar
  pendiente**, que es lo que más se cae porque la vuelta recién terminada es la que parece
  terminada. Sin el número, la primera pregunta ante cualquier cosa que no se ve es «¿tengo
  lo nuevo?» y no se puede contestar desde la pantalla; con él, si no coincide falta el OTA
  y si coincide es un fallo y hay que ir a buscarlo.
- **Si una vuelta no se ha mergeado, dilo con esas palabras**, con la rama, la PR y de qué
  está esperando. Un resumen de trabajo hecho se lee como trabajo entregado, y desde el
  móvil una rama abierta y una fusionada son indistinguibles.
- **«Dame opciones» significa un artefacto, en línea y con cuatro como mínimo**, cada una
  con **letra y número** (`A1`, `C3`) para que decidir quepa en una ficha corta y siga
  siendo inequívoco con varias preguntas sobre la mesa. Las opciones se comparan mirándolas
  a la vez, no leyendo una lista. El artefacto enseña **lo que he pedido o lo que cambia, y
  nada más**: las decisiones ya tomadas se quedan fuera salvo que sean justo lo que se
  reabre o que las pida yo.
- **Pedir opciones no es pedir código: cuando pido opciones, no se implementa nada.** Se
  piensa, se hace el artefacto en línea y se me da a escoger. Ahí acaba la vuelta: sin
  ramas nuevas, sin PR, sin «y de paso he dejado hecha la parte fácil». Y esto vale
  **aunque en el mismo mensaje haya pedido cambios concretos**: si en el encargo aparece
  «dame opciones», lo que sale de esa vuelta es la hoja, y lo demás espera a que elija.
  El motivo es que elegir mirando cinco dibujos y elegir mirando uno ya escrito no es lo
  mismo: lo implementado empuja la decisión y encima hay que deshacerlo. Si algo del
  encargo parece urgente y no depende de lo que se decide, se **dice** en la respuesta y
  se espera al «sí».
- **Los comandos que me pasas para ejecutar van sin comentarios.** Nunca un `#` dentro del
  bloque. Lo que haya que explicar —qué hace, qué variable tocar, qué esperar— va **fuera**,
  en prosa, antes o después. Un bloque se copia entero y se pega en una terminal, muchas
  veces desde el móvil: los comentarios lo alargan, envuelven líneas y hacen que haya que
  leerlo para copiarlo, cuando lo único que se quiere es copiarlo. Esto vale para lo que se
  pega en el chat, **no para el código del repositorio**, donde los comentarios que dicen
  el porqué son media casa —mira `patch-ios.mjs` o `revocacion.js`— y no se tocan.

### Cómo se hace una hoja de opciones (la vara es `meeting-ops-air`)

Sus hojas de `specs/design/` son mejores que lo que se hacía aquí, y esto es lo que las
hace mejores. Vale para diseño y también para cualquier decisión que se me traiga.

1. **El título es la frase del problema, no la etiqueta del tema.** «Los dos verbos detrás
   de una fila, cuando las palabras son demasiado grandes para estar ahí», no «Verbos».
   Quien abre la hoja ya sabe qué se decide antes de mirar nada.
2. **Ficha de contexto arriba, en una línea**: qué versión está dibujada como «ahora», a
   qué medida se dibuja (`390 pt`) y con qué paleta. Sin eso, no se sabe si lo que se
   compara es lo que hay puesto.
3. **Separa los defectos de las decisiones, y hazlo antes de las opciones.** «Antes de las
   opciones · dos arreglos que no se eligen»: lo que está mal se arregla y se cuenta, no se
   somete a votación. Sobre la mesa queda solo lo que de verdad tiene alternativas.
4. **Números medidos, no adjetivos.** «32 intercambios antes, 2 después»; «92 pt cada
   palabra»; «16 pt es el ancho de un pulgar». Si digo que algo no cabe, digo cuánto le
   falta.
5. **Dibujado al tamaño al que se sirve**, con el **contenido real de la app** repetido
   igual en todas las opciones, para que lo único que cambie sea el tratamiento. Nada de
   texto de relleno ni de cajas grises.
6. **La hoja es un argumento con partes**, no una galería: «Parte uno · lo que cuestan las
   palabras». Cada opción dice **qué cuesta y quién lo paga**, no si es bonita.
7. **Enseña las combinaciones** cuando las haya («A2 con D1 y C1»): muchas veces la buena
   no es ninguna de las cinco sino dos de ellas.
8. **La hoja se queda en el repo**, en `docs/diseño/*.html`, y el CSS o el spec la citan
   por nombre y código de opción (`ver docs/diseño/iconos.html · I4`). Un artefacto
   publicado se pierde; un fichero versionado explica dentro de seis meses por qué una
   variable vale lo que vale. Publicar el artefacto es además de eso, no en vez de eso.

Y una regla de oficio que ya me ha mordido: **una maqueta se comprueba en un navegador
antes de enseñarla**, midiendo lo que dice enseñar. Un `.oscuro .t-pastilla` con espacio
—descendiente, cuando las dos clases van en el mismo elemento— dejó cinco opciones pintadas
exactamente igual y con toda la pinta de estar bien.

## Estado y pendientes

**Hecho:** eventos, familias/bungas/personas, gastos con reparto por familia + liquidación,
cenas (platos, bungas mayores/niños), planes (votación, día), agenda, estadísticas, 5 temas.
**Backend propio** (Worker + D1), cola de cambios, Sign in with Apple y alta por invitación.
**La puerta de acceso ya no es un muro**: si Apple falla se puede seguir en local y lo
apuntado sube al entrar (SPECS §14.9).
**El grupo en una sola sección** (SPECS §14.14): una ficha por familia con su bunga en una
pastilla y su gente dentro, «Sueltos» para lo que no está colocado, y **edición de verdad**
—se toca la fila y sube una hoja desde abajo—. Borrar salió de los renglones y vive al lado de Guardar,
diciendo qué se lleva. **El evento también se edita ahí**, avisando de las cenas y
planes que se caen al acortar las fechas. Ajustes va en el orden de lo que se toca
(Aspecto · Evento · El grupo · Quién eres · Estadísticas · Sincronización · La app) y
**cada acordeón recuerda si estaba abierto**, que es lo que hacía falta al recargar
tras actualizar. Decidido en `docs/diseño/gente.html` (G2 · A3) y
`docs/diseño/gente-editar.html` (E1 · F2 · N2 · N4 · D1).
**Repaso de UX/UI** (SPECS §14.10–14.12), inspirado en `meeting-ops-air` y
`garciadoral-ops`: barra de **Agenda · Dinero · Comidas · Planes · Ajustes** con los ajustes
abajo a la derecha, **Ajustes en acordeón** (`<details>` nativo, todo plegado) que se ha
comido «Más» —Estadísticas, Quién eres (con tu perfil) y Evento son apartados—, cabecera de
tres cosas con el punto verde que **sincroniza todo** (datos + versión de la app) con su
lista de progreso, tipografía a 17 px ×1,12 de fábrica, y dos temas de máximo contraste.
**Deslizar una fila de gastos** descubre Editar y Borrar (§14.10-bis), y el botón de crear
lleva la palabra puesta («+ Gasto»). **Cada sección se parte en áreas** con el mando de
`SubNav` (§14.10-ter, opciones en `docs/diseño/navegacion.html`): Agenda es Hoy · Días —con
la lista entera de días, vacíos incluidos, y su modal para editar cada uno— y Comidas es
Cenas · Platos · Compra, con el catálogo de platos por fin editable. **Un solo tema** (Abisal Sobrio, claro y oscuro),
**iconos de línea** con tono por categoría, pesos de letra más bajos y un solo botón lleno
por pantalla (§14.12–14.13).

**Preparada para la App Store** (`docs/APPSTORE.md`): **baja de cuenta** desde Ajustes con
revocación ante Apple (directriz 5.1.1(v), `api/src/revocacion.js` + `POST /api/cuenta/baja`),
**modo de demostración** desde la pantalla de acceso —lo único que deja ver la app a quien no
está invitado, que es el caso de quien la revisa (directriz 2.1, `app/src/lib/demo.js`)—,
páginas de **privacidad** y **soporte** en `app/public/`, y `patch-ios.mjs` declarando el
cumplimiento de exportación, «solo iPhone», el nombre bajo el icono y el permiso de avisos.
**Hay avisos al móvil** (SPECS §14.17): APNs directo desde el Worker (`api/src/apns.js`,
portado de `garciadoral-ops`) y el plugin oficial de Capacitor, sin el SDK de terceros que se
retiró en su día. El permiso se pide en Ajustes → Notificaciones, no al arrancar, y **exige
binario nuevo**: los plugins nativos no viajan por OTA. La demostración convive con
«usar solo en este móvil» y resuelve otra cosa: la local arranca vacía y lo apuntado sube al
entrar, la demostración arranca llena y no sube nunca. 150 tests en la PWA + 37 en la API,
todos en verde.

**Pendiente de despliegue** (pasos manuales, `docs/DESPLIEGUE.md`): crear la D1 y pegar su
`database_id`, registrar los secretos, dar de alta los identificadores de Apple, crear el
proyecto de Pages, rellenar `config.json` y **sembrar desde JSONBin**. Hasta que eso esté,
la app funciona en modo solo-local.

**Iconos de la app, de un solo dibujo** (SPECS §14.13): `app/assets/icon.png` alimenta el binario
de iOS (`assets:ios`) **y** la web/PWA (`npm run iconos:web`, sharp sin guardar). Se retiró
`public/favicon.svg`, que hacía que la app instalada y el navegador enseñaran dibujos distintos.

**Pendiente (ideas):** el **camino del fallo de sincronización** sin ver contra una API real
(§14.9-bis; está probado con tests, no en pantalla) · **compartir** los avatares con
foto con el grupo (hoy son locales del móvil, `lib/avatares.js`; hacerlos comunes pide
almacenamiento aparte, fuera de la sync) · lista de la compra agregada (usa
`Dish.ingredientes`).
