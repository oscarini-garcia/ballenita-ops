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
- **Sin red, el punto dice cuántos cambios esperan** (SPECS §14.9-quinquies,
  `components/SyncDot.jsx`): el motor contaba la cola y tiraba el número —solo guardaba
  `dirty`—, y «cambios sin subir» dice lo mismo con uno que con veinte. Ahora `pendientes`
  es el número, sale en el punto, en su rótulo y en su renglón, con tope de 99 en el punto
  (la cabecera es de 390 pt) y sin pintarse dentro de una tarjeta, donde no cabe y sobra.
- **`fetch` no tiene plazo, y por eso los avisos se quedaban girando** (SPECS §14.17-ter,
  `sync/api.js` · `PLAZO_API`): «Encender» se quedaba en «Pidiendo…» para siempre, y el
  eslabón que se colgaba no era ninguno de los tres que este apartado había mirado —Apple,
  el binario, el permiso— sino el cuarto, el `POST /api/push`, que no se nombraba en ningún
  sitio. Una dirección que no responde deja una promesa que **ni se cumple ni se rompe**.
  Toda petición sale con corte de 20 s; `register()` ya no se espera delante de su propia
  carrera (figura de `garciadoral-ops`: una promesa contestada desde donde llegue la
  respuesta —token, error o reloj—); y los cuatro eslabones se pintan con `ListaDePasos`,
  porque se arreglan en cuatro sitios distintos y se veían igual. El entitlement se
  **escribe** en vez de avisarse (`scripts/entitlements.mjs`): un `App.entitlements` sin
  `CODE_SIGN_ENTITLEMENTS` no se firma, y eso es indistinguible de no tenerlo.
- **Una receta lleva cantidades, y de ahí sale la compra** (SPECS §14.20,
  `docs/diseño/cenas-cantidades.html` · G2·A1·C1·D5·E2·F1): el plato dice **para cuántas
  raciones** es (`raciones`) y cada ingrediente **cuánto**; estirarlo a la gente que hay es
  una regla de tres con los pesos de siempre (`lib/compra.js`), **no la IA**. La mesa de
  niños hereda los platos mientras `platoIdsNinos` sea `null`. La compra enseña el total
  redondeado al envase y el reparto al abrir la línea; al cambiar una cena se rehace y **lo
  dice**, pero **nunca toca lo escrito a mano ni lo ya comprado**.
- **El editor de receta: dos campos y dos botones** (SPECS §14.20-bis,
  `docs/diseño/receta-ingredientes.html` · U1·B3·R1·L2+L4·P2·Q): la unidad va dentro de la
  cantidad («1,2 kg» de un tirón), aspa de 26 pt, fila vacía siempre al final y pegar reparte
  líneas. **Arreglar** ordena lo escrito a saco y **se deshace**; **Parecidos** propone cinco
  platos enteros y coger uno **no guarda nada**: reabre el editor con todo puesto.
- **En Planes solo se vota, y un plan solo nace de una idea** (SPECS §14.19,
  `docs/diseño/planes-votar.html` · V3·V5·S2): el «+ Plan» se retiró —dos caminos para
  crear un plan dejaban planes sueltos sin idea detrás, que es media razón de ser del
  catálogo— y la pantalla dice por dónde se entra; el día se pone en **Agenda**; la lista son dos grupos —elegidos y disponibles por votos— con
  filas de 70,7 pt (antes tarjetas de 299,9 con siete botones y ocho colores); al abrir un
  plan salen **los nombres** bajo su voto —con su avatar y el alias de su familia— y
  **cuántos son**, y quién falta se dice en la fila cerrada y no dos veces. Ese modal se
  ve como capa (`docs/diseño/plan-voto.html` · P1·F1+F4·V2): antes tenía el papel del
  color del fondo, 1,0 : 1. **La IA sugiere ideas**
  (`api/src/sugerencias.js`, §14.19-bis): tanda de cinco, el material lo compone el Worker y
  **los nombres no viajan**.
- **Un día del viaje son cuatro renglones** (SPECS §14.21, `docs/diseño/agenda-dia.html` ·
  A1·B4·F1·G1·C2·D2·E1): qué bungas, **qué se cena** y **qué plan**. La fila de un día ya no
  lleva lápiz —un día no se edita, existe porque el evento tiene esas fechas— y el modal pasó
  de 1.773,8 pt a 679,8: los platos se marcan en una hoja (`HojaDeMarcar`), los planes libres
  se eligen en otra —con los votos y quién falta—, «Qué se hace» y «Cantidades» se retiraron
  (las columnas siguen en D1) y «Plato nuevo al vuelo» volvió a Comidas → Platos. **Libre**
  incluye lo que se cayó fuera de las fechas, que antes desaparecía del modal.
- **El día se abre como un plan, y cada toque escribe** (SPECS §14.30,
  `docs/diseño/dia-abierto.html` · M2·H1·R2·P2): el día era el único formulario pegado abajo
  —seis controles de cuatro figuras— que guardaba la mitad con un botón que decía «Guardar la
  cena» y perdía la otra mitad al cerrar. Ahora es la **capa centrada de un plan** con tres
  renglones gemelos —platos, bungas, plan— que abren hojas (`HojaDeMarcar`, `HojaDeBungas`);
  **no hay botón de guardar**: la cena nace sola con el primer toque, quitarla pide segunda
  pulsación dentro de su hoja, y en la hoja de planes marcar pone y desmarcar quita. En «Hoy»
  el titular **titula lo que hay** (`titularDeHoy`): sin cena manda el plan del día, no un
  «Sin cena montada» encima de la playa confirmada.
- **Los elegidores del día: al centro, con borrador y buscador** (SPECS §14.31,
  `docs/diseño/elegidores.html` · C2·V2·S2·B1·L3+L1): revisa el «cada toque escribe» de §14.30
  **solo dentro de un elegidor** —trabaja sobre un borrador: «Listo» escribe todo junto,
  «Cancelar» y el fondo descartan, porque un «Cancelar» sin borrador es un verbo que miente—;
  el elegidor **sustituye** a la capa del día (capa sobre capa se lee como marco doble) y lleva
  el día en su cabecera; el día son **tres secciones** —cena, bungas con dos filas, plan— y cada
  bunga abre su lista de una, donde **la familia manda** y el alias queda de seña (el selector
  doble con fila rica medía 815,8 pt y el tope de una capa es 658,3); platos y planes llevan
  **buscador siempre visible** (`filtraOpciones`, sin tildes y sin robar el foco), las bungas
  no. `HojaDeMarcar` se retiró con su único consumidor.
- **El día lleva semáforo, y el vacío no grita** (SPECS §14.32, `docs/diseño/dia-estado.html`
  · E1·K4·G1·D1): el icono de cada renglón del día tiñe —verde de Planes con algo elegido,
  **ámbar** (`--gold`, `.ico.ambar`) cuando falta—, cada renglón el suyo y la lista de Días
  quieta. Se pidió rojo y la hoja lo dibujó: cuatro renglones rojos en un día sin montar, con
  el rojo que aquí es deuda y borrar — el ámbar es «pendiente», como el amarillo del punto de
  sincronización; pasar a rojo es una variable. Y **el bunga es masculino**: «Ninguno», «el
  de los Pérez», «Los bungas» — §14.31 lo escribió en femenino y §14.32 lo corrige.
- **Números crece y el semáforo llega a la lista** (SPECS §14.33, `docs/diseño/numeros.html`):
  la casilla del número de cada día tiñe —verde el completo (cena con platos, dos bungas y
  plan), ámbar el resto— y «hoy» pasa a un aro del acento; el selector del bunga lleva la
  pastilla de color de la familia (`Alias.jsx`) —y el balance de Números **enseña sus bungas
  igual**, que a quién le toca acoger es a una familia—; en Números el balance de anfitrión va
  primero, y entran cuatro fichas —día más caro (por día **local**), «Así vais a acabar»
  (solo durante el viaje), días con plan, racha de cenas— y dos retratos al pique (el
  entusiasta 👍 y el indeciso 🤷, con los empates dichos). Todo en `computeStats`, local y
  puro; nada señala fuera del interruptor.
- **En Saldos la familia lleva su pastilla, y el renglón dice quién paga a quién** (SPECS
  §14.35, `docs/diseño/saldos.html` · F3·R2·E1): el emoji sobre el color pleno se va —las
  iniciales ahí dan 2,81 : 1 en el azul de los Solteros, y la pastilla de `Alias.jsx` da
  4,82–5,85 en las dos caras con cualquier color—; la sección es **«Quién paga a quién»**,
  la fila son dos líneas con «pagado» al lado (93,5 → 70,7 pt) y **sin tocar la letra**: le
  sobraba estructura, no tamaño. Quien no tiene familia sale con su nombre, no como «Sin
  familia». La hoja se corrigió antes de escribir el spec: su maqueta **doblaba** el titular
  donde `theme.css` lo **recorta**, y por eso midió 119,4 en vez de 93,5.
- **Tu estado vive en la cabecera, y el del grupo en Hoy** (SPECS §14.36,
  `docs/diseño/estado.html` · A3·V1·M2·I1+I3·G3): la segunda línea de la barra deja el lugar
  y pasa a ser **tu estado**, tocable (`PastillaDeEstado`) —es la única colocación que no
  recorta el nombre del evento, y cuesta 15,3 pt de alto—; sin estado **invita**, sin
  identidad vuelve el lugar. El modal es capa centrada con cinco estados enteros, «Otras
  cinco» (IA, solo al pulsar) y «Más gracioso» sobre lo tuyo, que no guarda nada. Y la tira
  de «Hoy» enseña **quién anda en qué**: el estado sincronizaba desde siempre y no se pintaba
  en ninguna pantalla. **La pastilla admite dos líneas y la tira va por novedad** (§14.36-bis):
  de 37 letras a 65, creciendo 2,9 pt **solo** cuando se usa la segunda; cada nombre lleva el
  acrónimo de su familia (`Alias.jsx`); y el orden lo da **`estadoEl`**, que escribe el
  cliente al guardar (migración `0013`) y no `updatedAt`, que se mueve al corregir un apodo.
  Lo de antes de la migración no tiene fecha: va detrás y entre sí por nombre.
- **La marca es el icono de la app, y el rojo se reserva** (SPECS §14.37): `WhaleLogo` sirve
  `public/marca-192.png` con esquina al 22,37 %; tocabas un dibujo en la pantalla de inicio y
  se abría una app con otro. Y de ahí salió un desfase gordo: **el icono del binario no está
  en el repositorio** —`assets/icon.png` es otro dibujo—, así que correr `assets:ios` hoy
  devolvería el viejo a la pantalla de inicio; `assets/marca.png` es un apaño sacado de una
  captura de 202 px hasta que aparezca el original de 1024. En Actualizar, tres de los
  cinco desenlaces del OTA **no son un fallo** (`otaFueBien`) y salían en rojo por llamarse
  `fallo` la variable; y el bloque de migraciones **se callaba** al no poder preguntar, que
  desde el móvil se lee igual que «está al día».
- **Cada versión se describe a sí misma** (SPECS §14.34, figura de `meeting-ops-air`):
  `lib/notas.js` lleva unas líneas **a mano** por versión —lo que se nota en pantalla, no qué
  módulo se tocó—, Ajustes → 🐳 La app enseña la puesta y las tres de antes como tarjetas de
  lado, y `lib/notas.test.js` ata la entrada de arriba a `package.json`: **subir versión sin
  describirla pone las pruebas en rojo**. Al cerrar una vuelta que sube versión, añade su
  nota arriba del todo.
- **Las mejoras son el roadmap de la app, apuntado desde el móvil** (SPECS §14.22,
  `docs/diseño/mejoras.html` · A1·B1·C2·D2·E1·F2, figura del bloque «Mejoras» de
  `garciadoral-ops`): acordeón **Ajustes → Mejoras**, penúltimo y pegado a «Actualizar»,
  con **las que faltan en el rótulo**. Renglón fijo para apuntar (no se cierra al guardar),
  **visto delante** para tachar, lo hecho baja al final tachado, deslizar descubre Editar y
  Borrar —que no borra: abre la hoja con la pregunta puesta, «se va de la lista de todo el
  grupo»— y la firma es la de Ideas (nombre + alias + hace). Tabla sincronizada `mejoras`
  con tope de 2000 (cortado en `db.js`, rechazado en el Worker), el Demo escribe con su
  `eventId`. **Al empezar un encargo, lee las pendientes** —`GET /api/mejoras` con el
  `TOKEN_SERVICIO`, si esta sesión tiene la URL y el token—: es la pregunta que
  `garciadoral-ops` dejó abierta, y aquí el transporte ya no es una persona.
- **La lista de ideas se parte en dos, y cada idea la firma alguien** (SPECS §14.19-ter,
  `docs/diseño/planes-ideas.html` · A1·B3·F2·C1+C3·D3): **Propuestas** —las que ya están a
  votación en este viaje— y **Posibles**; la firma es nombre + **alias de dos letras** de su
  familia en pastilla de su color (`lib/alias.js`, se propone del nombre) + cuándo, y el
  «cuándo» es el del grupo —cuándo se propuso arriba, cuándo se apuntó abajo—. Se apunta desde
  un **renglón fijo bajo el mando**, que no se cierra al guardar: el modal ocupaba 455,4 pt de
  los 508 que quedan sobre el teclado y se escribía sin ver el catálogo. Las dos fechas las
  escribe el cliente (`apuntadaEl`, `propuestoEl`), no `creadoEn`, que es del servidor.
  **El editor de una idea abre centrado y sin robar el foco** (§14.24) —el teclado no sale
  hasta tocar un campo; vale también para la hoja de una mejora— y lleva **«Mejorarla»**:
  la figura de «Arreglar» de la receta, encargo `mejorarIdea` (`api/src/idea.js`,
  `POST /api/idea/mejorar`) — rellena sin guardar, se deshace, y los nombres no viajan.
- **Un plan es dos cosas** (SPECS §14.18, `docs/diseño/planes-catalogo.html` · A3·B3·C1): la
  **idea** que se repite (`planIdeas`, catálogo compartido como `dishes`) y la **propuesta de
  este año** (`plans`, con día, estado y votos). Traer una idea **copia**, no enlaza: el día,
  el estado y los votos no viajan nunca. Planes tiene ahora dos áreas, Planes · Ideas.
- **Entre quién se divide: cuatro atajos, las familias, y salir sin guardar** (SPECS §14.27,
  `docs/diseño/gasto-entre.html` · A3·B2·C2+C4·D2+D4·E2): eran dos chips y los nueve nombres
  del grupo seguidos —711,3 pt de 844, el 84 %, de los que 434 eran nombres—, y tocar el fondo
  **guardaba**. Ahora son **389,6 pt** (421,6 en Enorme) con tres niveles y solo dos
  desplegados: los cuatro atajos en un **segmentado** —los chips no caben, 384,7 pt de 356—,
  las familias con su recuento, y la gente **dentro de su familia**. La casilla marca (44 × 44)
  y el cuerpo abre; los tres estados se dibujan. El buscador vive detrás de una lupa que
  comparte renglón, y al escribir las familias se retiran. **La hoja trabaja sobre un
  borrador**: «Cancelar», el fondo y deslizar descartan; solo «Listo» guarda. Todo lo que
  decide quién entra está en `lib/reparto-gente.js`, puro.
- **La puerta cabe, la sala de espera es la pantalla y entrar por primera vez se cuenta**
  (SPECS §14.29, `docs/diseño/acceso.html` · A3·B2+B4·C2+C4): la pantalla de acceso pedía
  **909,2 pt** —**1.292,8** con la sala de espera— en una ventana de 844, y `.acceso` centraba
  **sin `overflow-y`**, así que lo que sobraba no se apartaba sino que se **recortaba** por los
  dos extremos (196,5 y 196,5) y no había forma de llegar. Ahora hace scroll, nadie se aplasta
  (`flex: none`), las pistas pierden el marco de rayas que dejaba `.acceso > .note` al no
  reponer `border`, y **nada de esta pantalla sigue al tema**: es oscura siempre, y heredar
  `.note` ponía el párrafo de la espera a **1,52 : 1** con el móvil en claro. La puerta son tres
  cosas y un **pie de tres renglones**, cada uno con su hoja. La sala de espera **sustituye** a
  la puerta, se recuerda entre arranques (`auth/espera.js`) y **entra sola**: `POST
  /api/sesion/espera` con un **pase** firmado (`tipo: 'espera'`, 30 días, y las dos direcciones
  cerradas: una sesión no vale de pase ni un pase de sesión) evita volver a sacar la hoja de
  Apple cada veinte segundos. Y al entrar por primera vez, `BienvenidaScreen` cuenta la bajada
  con la lista de pasos (`lib/primeraBajada.js`, que **no** comprueba la versión: recargar recién
  entrado es la peor primera impresión) y se entra sola si hay un único evento. **El motor
  recibe la sesión como dependencia**: montaba con `[]` y su primera vuelta era sin sesión, y por
  eso al ser aceptado la app decía que no había ningún evento hasta reiniciar.
- **El mapa del repositorio se compone leyendo el código** (SPECS §14.28,
  `herramientas/mapa.mjs`): determinista, sin IA y **sin dependencias**, lo inyecta el hook
  de `SessionStart` **recién generado** —no lee `docs/mapa.md`, que es lo que hace que no se
  desfase— y CI lo comprueba con `--verificar`. Lo escribió la PR #28 en julio y se quedó sin
  fusionar; diez meses después **funcionó contra el código de hoy sin tocarle una línea**, y
  eso es lo que decidió rehacerla. Su lista de **desfases** encontró que `otaManifiesto`
  llevaba desde julio en `config.json` sin que nadie lo leyera, que `notifyGroup` y
  `VITE_PUSH_ENDPOINT` eran código muerto de la era OneSignal, siete rutas sin documentar y
  doce módulos sin cabecera. **Cuando salte un desfase se arregla el código, no el
  generador** — salvo que sea del generador, como el que decía que `mejoras` no estaba en
  ninguna migración.
- **Lo que dijo el móvil y no decía la hoja** (SPECS §14.27-bis): **un gasto se corrige
  tocándolo** —corregir estaba detrás del gesto de deslizar, y es la mitad de las veces que
  se abre un gasto; «Editar» se retiró y queda «Borrar»—; los dos verbos vuelven **abajo y en
  azul** y «Entre» pasa a **modal centrado**, porque era el único sitio de la app que
  confirmaba arriba; **«Detalles» baja al final del formulario**, con «Paga» y «Entre», que es
  donde se rellena y no delante de la cifra; **el modal no cambia de tamaño, hace scroll**
  (649,8 pt en Grande, tope en Enorme); el campo «Cuándo» **se veía en blanco** —
  `datetime-local` no estaba en la lista de campos vestidos, tercera vez que muerde lo mismo:
  ahora hay guardia que saca los tipos del JSX—; y es un **coeficiente**, no un peso (cambia
  la palabra, no el campo `pesoReparto`).
- **Un modal se ve como una capa, y ya no hace falta acordarse** (SPECS §14.26-bis · F3): el
  papel era `--foam`, que es `--app-bg` —1,00 : 1, y 1,06 con velo en oscuro—. `.capa` lo
  arreglaba desde §14.19 en **un** modal y once seguían sin ella, así que sube al `.modal` de
  todos: papel propio (`--papel-capa`), canto de 1,5 (`--linea-capa`) y velo a .68. **El velo
  solo no valía**: de .50 a .78 son cuatro centésimas en oscuro. Dentro de una capa,
  `--foam-2` baja un escalón **redefiniendo la variable**, no cada regla. La guardia está en
  `src/estilos.test.js` y mira el CSS, no las clases.
- **Un gasto se apunta sin teclado y con la cuenta hecha** (SPECS §14.26,
  `docs/diseño/gasto-nuevo.html` · A1·B3+B2·C1·D2·E2): la ficha medía 830,6 pt de 844 y
  abría el alfabético sola, dejando 508 de ventana —el 61 %— y un scroll dentro del modal
  para llegar a Guardar. Ahora son dos pantallas: la **rápida** (603,6 pt en Grande, 651 en
  Enorme, sin scroll) con un **pad propio de 4 × 4 que suma y resta** —se teclea **como una
  caja registradora**, `2·4·3·0` son 24,30, y por eso no hay coma sino `C`; toda la
  aritmética en `lib/importe.js`, pura—, las cinco categorías **con su tono siempre puesto**
  y los dos renglones «Paga · tu familia» y «Entre · todos», que dicen lo que se va a
  guardar y se tocan; y **Detalles** en capa aparte con la descripción —ya **no obligatoria**:
  la fila se llama por su categoría si no la hay—, la fecha, la moneda y el **reparto fino**.
  Ese es el único que toca la base: `expenses.reparto` (`{modo:'partes'|'importes',
  porFamilia}`, migración `0012`), **nulo = por pesos**, importes en **céntimos** y los tres
  modos por `splitCents()`, así que no se pierde un céntimo y un cliente viejo sigue leyendo
  el gasto. Los cinco tonos de categoría subieron de saturación al verlos juntos en rejilla.
- **La cabecera sabe qué hora es, y al final de la lista alguien habla** (SPECS §14.25,
  `docs/diseño/verano.html` · A4·B2·C2+C4·D2+D3): una franja de **4 pt** bajo la cabecera (a `z-index: 7`, o la cabecera le tapa medio sol)
  que se llena de amanecer a anochecer con el sol de tirador (`components/LineaDelHorizonte.jsx`);
  la hora se **calcula** (`lib/sol.js`, sin red ni dependencias) porque dos constantes de verano
  mienten 3 h 28 en enero. Se descartó el arco que cruza la cabecera: el disco pasa **7 h 29 al
  día por detrás del título**. Abajo, un emoji y una frase **al final del scroll y en los
  vacíos** —0 pt permanentes—, no en un renglón fijo sobre la barra, que costaba de 42,6 a 66,2 pt
  y cobraba más caro al que peor ve. Las frases salen de **los datos del viaje** (`lib/recados.js`,
  con su guarda cada una y **sin señalar a nadie**) y de una **tanda de doce de la IA**
  (`api/src/recados.js`), mezcladas en una bolsa. **La ventana de dos horas se cumple dos veces**:
  la del Worker ahorra la llamada de pago, la del móvil la petición — sin las dos, nueve
  teléfonos son nueve llamadas y nueve bromas distintas a la vez. Salen unos **tres céntimos al
  día** con haiku. **La cabecera cambia además de color con la hora** (A2, `lib/cielo.js`): la
  franja sola no bastaba porque se llena desde el amanecer, y a las 08:07 son 27,3 pt de 390 —a
  la hora a la que se abre la app no se veía nada—. Siete tonos hondos, peor contraste **7,54 : 1**,
  comprobado minuto a minuto de las 24 horas.
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
  **El administrador no espera en su propia sala** (`api/src/administrador.js`, SPECS §14.15): si
  el correo que verifica Apple en el token es el suyo, entra solo como administrador y enlazado
  con su persona — sin esto, salir de la cuenta el único administrador era un cerrojo. Y como con
  «Ocultar mi correo» llega un relé, el **nombre** (sin tildes) es segunda llave, válida **solo
  sin ningún administrador activo**: el nombre no lo firma Apple, lo manda la app.
- **La clave de la IA vive en el servidor** (tabla `configuracion`, SPECS §14.16) y no vuelve
  entera a ningún móvil: es una credencial de pago. **El modelo se elige de una lista** que trae
  el Worker de Anthropic, y hay un botón que **prueba el par clave+modelo** con una llamada de
  verdad (§14.16-bis, `api/src/ia.js`). **Si el modelo apuntado ya no existe se cambia solo por
  el más nuevo de su familia** —al traer la lista, y al usarlo reintentando solo con un 404— y
  se dice por cuál: un modelo retirado no rompe el día que lo retiran, rompe meses después.
- **Lo que se le pide al modelo se escribe en Ajustes** (`api/src/encargos.js`, SPECS
  §14.16-quater): la clave y el modelo valen para todo, el **encargo** es de cada cosa —hoy
  uno, las ideas de plan—. **Vacío devuelve el de origen**, la forma de la respuesta es parte
  del encargo (si le quitas el JSON deja de salir nada) y **solo se guardan los del catálogo**:
  sin ese filtro, un encargo llamado `clave` machacaría la credencial de pago.
- **Cada encargo puede llevar su propio modelo** (SPECS §14.16-quinquies): la clave es de la
  instalación, el modelo no. `ia.modelo:<id>` con el mismo filtro que los encargos, y el orden
  es lo guardado → el de origen del encargo → el general. Traen uno puesto «Ordenar una
  lista de ingredientes» y los recadillos (haiku: traducción y frases cortas) y «Mejorar
  la redacción de una idea» (Sonnet fijado: la coña que no aterriza es peor que ninguna).
- **Un campo es su rótulo, el control y la pista debajo** (`components/Campo.jsx`, SPECS
  §14.16-ter, figura de `garciadoral-ops`): el estado vive **en el campo** —«Guardada, termina
  en ab12»— y no en una ficha con icono encima, y lo que contesta el servidor va en una
  **traza** (`<pre class="traza">`, `bien`/`mal`) y no en prosa. En **Actualizar** el progreso
  se pinta en su sitio, como en Sincronización: el modal tapaba lo que se venía a mirar y
  borraba lo que había contado al cerrarse.
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

**No se escribe a mano: la genera `herramientas/mapa.mjs` leyendo el código** y vive en
[`docs/mapa.md`](docs/mapa.md) (SPECS §14.28). El árbol que había aquí se desfasaba en
silencio —llegó a quedarse sin cuatro pantallas y a decir que Apple funciona en web—, y
ahora sale de las cabeceras, los `export`, la tabla `RUTAS`, `SYNC_TABLES` y las
migraciones, con los recuentos de pruebas incluidos. Un `SessionStart` lo inyecta **recién
generado** al abrir sesión, así que no hace falta leer el fichero; el fichero está para
que CI compruebe con `--verificar` que no miente. Si algo falta ahí, falta en el código.

El mapa lleva además una lista de **desfases**: un hecho declarado en dos sitios que ya no
coinciden. Cuando aparezca uno, se arregla el código —no el generador.

## Despliegue

- **Web:** Cloudflare Pages conectado al repo; build `cd app && npm ci && npm run build`,
  salida `app/dist`. Cada push a `main` republica. Base path `/` (ya no hay subpath).
- **API:** se publica **sola en cada entrada a `main`**
  (`.github/workflows/desplegar-api.yml`, secreto `CLOUDFLARE_API_TOKEN`), y a mano
  desde Actions → desplegar api → Run workflow, que es lo que se puede pulsar desde el
  móvil. `cd api && npm run desplegar` sigue valiendo como salida de emergencia.
  **El filtro `paths: api/**` se retiró** y no es un descuido: si el empujón que trae
  el cambio no llega a disparar el flujo —le pasó al merge de la v0.21.0, hecho por la
  API de GitHub—, ningún empujón posterior que no toque `api/` lo reintenta, y la única
  salida es el botón de «Run workflow», que **necesita un permiso que no tiene la
  aplicación que conduce esto**. Publicar es idempotente y tarda segundos; el filtro
  ahorraba eso y a cambio dejaba el Worker impublicable. Misma corrección en `ota.yml`.
  La figura es de `meeting-ops-air`, que se comió el problema entero antes.
  **Las migraciones no se lanzan solas**, a propósito, pero ya no exigen portátil
  (SPECS §14.23): si administras y la base va por detrás del código, **Ajustes →
  Actualizar** lo dice y las aplica una a una contando el progreso — el SQL vive
  **dentro del Worker** (`api/src/migraciones.js`, generado con
  `npm run generar:migraciones`; el test avisa si se olvida regenerar). La consola
  de D1 y `npm run migrar:remotoN` siguen valiendo. Secretos del Worker:
  `SESION_SECRETO` y `TOKEN_SERVICIO`, con `wrangler secret put`.
- **Pruebas:** `.github/workflows/pruebas.yml` corre las dos suites en cada rama.
- **OTA de iOS:** sube la versión en `app/package.json` y mergea (`ota.yml`). Corre en
  **cada** empujón a `main` y decide la guarda: si esa versión ya tiene release y el
  bundle no cambia, lo dice y sale; si ya tiene release **y el bundle sí cambia**,
  **falla a propósito** —eso es trabajo en `main` que no llegaría a ningún móvil, y el
  silencio es peor que el fallo—.
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
(Aspecto · Evento · El grupo · Quién eres · Sincronización · La app) y
**cada acordeón recuerda si estaba abierto**, que es lo que hacía falta al recargar
tras actualizar. Decidido en `docs/diseño/gente.html` (G2 · A3) y
`docs/diseño/gente-editar.html` (E1 · F2 · N2 · N4 · D1).
**Repaso de UX/UI** (SPECS §14.10–14.12), inspirado en `meeting-ops-air` y
`garciadoral-ops`: barra de **Agenda · Dinero · Comidas · Planes · Ajustes** con los ajustes
abajo a la derecha, **Ajustes en acordeón** (`<details>` nativo, todo plegado) que se ha
comido «Más» —Quién eres (con tu perfil) y Evento son apartados—, cabecera de
tres cosas con el punto verde que **sincroniza todo** (datos + versión de la app) con su
lista de progreso, tipografía a 17 px ×1,12 de fábrica, y dos temas de máximo contraste.
**Deslizar una fila de gastos** descubre Editar y Borrar (§14.10-bis), y el botón de crear
lleva la palabra puesta («+ Gasto»). **Cada sección se parte en áreas** con el mando de
`SubNav` (§14.10-ter, opciones en `docs/diseño/navegacion.html`): Agenda es Hoy · Días ·
Números —los días con su capa para editar cada uno, y **Números es Estadísticas**, que dejó
Ajustes porque se mira, no se ajusta; el rótulo corto es porque «Estadísticas» mide 121,2 pt
y la casilla del mando da 103,3— y Comidas es Cenas · Platos · Compra, con el catálogo de
platos por fin editable. **Un solo tema** (Abisal Sobrio, claro y oscuro),
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
entrar, la demostración arranca llena y no sube nunca. 643 tests en la PWA + 143 en la API + 24 del generador,
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
**Las ideas nuevas ya no se apuntan aquí**: viven en **Ajustes → Mejoras** (§14.22) y se
leen con `GET /api/mejoras`. Esta lista se queda para lo que ya estaba y para lo que no es
una mejora de la app sino una obra.
