# Mapa de Ballena Ops 🐳

<!-- GENERADO por herramientas/mapa.mjs leyendo el código. NO se edita a mano. -->
Dónde mirar sin leerse la aplicación entera. Si algo falta aquí, falta en el código.

## ✅ Sin desfases

Cada hecho declarado dos veces coincide con su gemelo.

## Las dos piezas

- **`app/`** v0.37.1 — PWA para gestionar los eventos del grupo de amigos — gastos estilo Splitwise entre familias, offline-first. 🐳
  820 pruebas en 88 ficheros · `npm test` → `vitest run`
- **`api/`** v1.0.0 — API de Ballena Ops sobre Cloudflare Workers y D1 🐳
  200 pruebas en 21 ficheros · `npm test` → `node --test 'test/*.test.js'`

## Rutas que sirve el Worker

De la tabla `RUTAS` de `api/src/index.js`; la descripción, de la lista de su cabecera.
`exige`: `sesión` = llama a `cuentaAutenticada` · `servicio` = comprueba `TOKEN_SERVICIO`.

| | ruta | exige | qué hace |
| --- | --- | --- | --- |
| `GET` | `/api/salud` | — | comprobación sin autenticar |
| `POST` | `/api/sesion` | — | canjea un token de Apple por una sesión propia |
| `POST` | `/api/sesion/espera` | — | «¿ya me han dejado entrar?», con el pase y sin Apple |
| `GET` | `/api/sync` | sesión | instantánea completa del grupo |
| `POST` | `/api/cambios` | sesión | aplica la cola del dispositivo y devuelve la instantánea |
| `GET` | `/api/cuentas` | sesión | quién tiene acceso (administradores) |
| `POST` | `/api/cuentas` | sesión | enlazar con persona, eliminar, activar y renombrar (administradores) |
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
| `POST` | `/api/recados` | sesión | una tanda de frases para el final de la lista (IA) |
| `POST` | `/api/importar` | servicio | siembra la base desde un volcado de JSONBin (servicio) |
| `GET` | `/api/mejoras` | servicio | las mejoras pendientes, para quien hace el trabajo (servicio) |
| `GET` | `/api/migraciones` | sesión | qué migraciones conoce el código y cuáles le faltan a la base (administradores) |
| `POST` | `/api/migraciones` | sesión | aplica la siguiente pendiente (administradores) |

## Barra de la PWA

**Agenda** (`agenda`) · **Dinero** (`dinero`) · **Comidas** (`comidas`) · **Planes** (`planes`) · **Ajustes** (`ajustes`)

## Tablas

- **Se sincronizan** (12, declaradas y contrastadas en `sync/tables.js`, `api/src/tablas.js`, la migración de D1 y Dexie): `events`, `families`, `bungas`, `persons`, `expenses`, `settlements`, `dishes`, `dinners`, `planIdeas`, `plans`, `shop`, `mejoras`
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
- `ORIGENES_PERMITIDOS` — `[vars]` = "http://localhost:5173"
- `SESION_SECRETO` — no declarada en `wrangler.toml` (secreto u opcional)
- `TOKEN_SERVICIO` — no declarada en `wrangler.toml` (secreto u opcional)

**PWA** (`app/public/config.json`, leído al arrancar): `api`, `otaManifiesto`

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

Primera frase de la cabecera de cada módulo, y sus símbolos públicos debajo.

**`app/src/`**

- `App.jsx` — El esqueleto de la aplicación: cabecera, cuerpo y barra de cinco destinos.
- `db.js` — IndexedDB desde el día 1 (§14).
  ↳ setApplyingRemote, removeRow, importSnapshot, exportSnapshot, olvidarTodo, createEvent · +67 más
- `main.jsx` — El arranque: monta React en el DOM y pone el tema y el tamaño de letra antes del primer pintado, para que la app no aparezca con la cara equivocada.

**`app/src/auth/`**

- `apple.js` — Acceso con Sign in with Apple — **solo dentro de la app de iOS**.
  ↳ codigoDeApple, explicarFalloDeApple, codigoDeAutorizacionDeApple, entrarConApple
- `espera.js` — La sala de espera, del lado del móvil.
  ↳ leerEspera, guardarEspera, olvidarEspera, preguntarSiYaEntro
- `sesion.js` — La sesión de este dispositivo: el token que firmó el Worker y a quién corresponde.
  ↳ leerSesion, guardarSesion, borrarSesion, modoLocal, activarModoLocal, salirDeModoLocal · +1 más

**`app/src/components/`**

- `Acordeon.jsx` — Un apartado plegable, con `<details>` y `<summary>` del propio navegador.
- `Alias.jsx` — El alias de una familia, en pastilla y con su color (`docs/diseño/planes-ideas.html` · B3).
- `BotonIA.jsx` — Un botón que le pregunta algo al modelo, y **dice que está pensando**.
- `Campo.jsx` — Un campo: su rótulo, el control, y **debajo la línea que lo explica**.
- `Confirmar.jsx` — La pregunta antes de borrar, en su sitio y diciendo qué se lleva.
- `Deslizable.jsx` — Una fila que se desliza a la izquierda para descubrir sus verbos.
- `Fab.jsx` — El botón de crear, con la palabra puesta.
- `Hoja.jsx` — Una hoja que sube desde el borde de abajo (`docs/diseño/gente-editar.html · F2`).
  ↳ HojaDeEleccion
- `HojaDeEstado.jsx` — Tu estado, en una capa centrada (`docs/diseño/estado.html` · M2 · I1 · I3).
- `Icono.jsx` — Los dibujos de la app, en una sola tabla.
  ↳ NOMBRES
- `Ingredientes.jsx` — Los ingredientes de una receta: **una lista sin cajas y un renglón al pie**.
  ↳ detalleDe, resumenDeLista
- `LineaDelHorizonte.jsx` — La línea del horizonte: tres puntos bajo la cabecera que son el día.
- `PadDeImporte.jsx` — La cifra grande y el pad de dieciséis teclas (`docs/diseño/gasto-nuevo.html` · A1, SPECS §14.26).
- `PastillaDeEstado.jsx` — Tu estado, en la segunda línea de la cabecera (`docs/diseño/estado.html` · A3 · V1).
- `PieDeVersion.jsx` — La versión que hay puesta, al final del scroll, y el botón de actualizar.
- `ProgresoModal.jsx` — Lo que está pasando, contado de arriba abajo, mientras dura un proceso largo.
  ↳ ListaDePasos
- `Recado.jsx` — Un emoji y una frase, al final de la lista.
  ↳ useRecado
- `SubNav.jsx` — Control segmentado que vive bajo la cabecera, dentro de una pestaña, para dividir una sección en dos (p. ej. Dinero → Gastos / Saldos).
- `SyncDot.jsx` — Punto de estado de la sincronización: color + ayuda + si conviene animar.
  ↳ enCambios, estadoSync
- `WhaleLogo.jsx` — La marca: **el icono de la app**, el mismo que se toca en la pantalla de inicio.

**`app/src/lib/`**

- `admin.js` — Quién manda aquí, y por qué está escrito a mano.
  ↳ ADMINISTRADOR, esAdministrador
- `alias.js` — El alias de una familia: **dos letras**.
  ↳ aliasSugerido, aliasDe, aliasSigueAlNombre
- `areas.js` — El área elegida dentro de una sección, que no se olvida al salir y volver.
  ↳ useArea, olvidarAreas
- `asignacion.js` — Quién se queda con qué bunga: el emparejamiento familia ↔ bunga.
  ↳ bungaDeFamilia, bungasLibres, familiasLibres, etiquetaBunga, etiquetaCorta, porNombre
- `avatares.js` — Foto de avatar de una persona.
  ↳ leerFoto, guardarFoto, borrarFoto, comprimirFoto
- `avisos.js` — Lo que está esperando a que alguien haga algo.
  ↳ avisosDeCuentas, avisosPara
- `borrados.js` — Qué se lleva por delante un borrado, dicho en una frase.
  ↳ familiasQueTocaUnGasto, queSeLlevaUnGasto, loQueSeCaeDeLaCompra, queSeLlevaUnaCena
- `categorias.js` — Las cinco categorías de un gasto.
  ↳ CATEGORIES, catOf
- `cielo.js` — De qué color está el cielo a esta hora.
  ↳ cieloDelMomento
- `cocina.js` — Con qué se cocina, tal como lo cuenta la pantalla (SPECS §14.20-quater).
  ↳ COCINA_DE_ORIGEN
- `compra.js` — De las cenas a la lista de la compra, pasando por las dos mesas.
  ↳ racionesPorMesa, platosDeLaCena, loQueHayQueComprar, comoSeReparte
- `config.js` — Configuración del despliegue, leída **en caliente** de `config.json`.
  ↳ cargarConfiguracion, olvidarConfiguracion, estaConfigurada
- `demo.js` — Modo de demostración: la app entera, con datos inventados y sin servidor.
  ↳ enDemo, activarDemo, salirDemo
- `dias.js` — Los días de un evento, y qué se hace en cada uno.
  ↳ diasDe, numeroYDia, diasEntre, platoQueManda, resumenDeDia, diaQueEnsenaHoy · +9 más
- `estados.js` — Un estado es **un emoji y una frase corta**: «🍺 de resaca».
  ↳ partirEstado, cincoAlAzar, quienTieneEstado, ESTADOS_DE_SIEMPRE, estadoEnUnaLinea
- `evento.js` — Qué se cae fuera al cambiar las fechas de un evento.
  ↳ dentroDeFechas, loQueSeCaeFuera, porDia, enPalabras
- `fechas.js` — Las dos reglas de un par de fechas «desde – hasta».
  ↳ diaSiguiente, finPara
- `hace.js` — Cuánto hace, escrito en palabras.
  ↳ formatearHace
- `ia.js` — ¿Se le puede preguntar algo al modelo **ahora mismo**?
  ↳ useIaDisponible
- `identidad.js` — Quién eres en un evento.
  ↳ getMeId, setMeId, useIdentidad
- `ids.js` — IDs generados en cliente (§12.2): así dos dispositivos offline no chocan al sincronizar.
  ↳ uid, now
- `importe.js` — La máquina de teclear un importe (SPECS §14.26, `docs/diseño/gasto-nuevo.html` · A1).
  ↳ desdeCents, totalCents, teclear, cinta, IMPORTE_VACIO, guardable · +2 más
- `money.js` — Todo el dinero se maneja en CÉNTIMOS enteros para no arrastrar errores de coma flotante.
  ↳ eurosToCents, centsToEuros, formatCents
- `native.js` — Puente con las capacidades nativas (Capacitor).
  ↳ urlDelManifiestoOta, isNative, tap, share, checkForOtaUpdate, versionInstalada · +11 más
- `notas.js` — Qué cambió cada versión publicada, en el idioma del grupo — la prosa de las tarjetas de Ajustes → 🐳 La app (SPECS §14.34, figura de `meeting-ops-air`).
  ↳ NOTAS
- `personas.js` — Lo que hace falta saber de una persona, sin React de por medio.
  ↳ EDADES, pesoDe, EMOJIS_PERSONA
- `planes.js` — Lo que se dice de un plan sin abrirlo: cuántos lo quieren y quién falta.
  ↳ quienFaltaPorVotar, votosDe
- `primeraBajada.js` — La primera bajada: traer lo del grupo justo después de entrar por primera vez.
  ↳ primeraBajada
- `push.js` — Que el servidor sepa a qué aparato mandar, sin que nadie lo pida.
  ↳ asegurarPush
- `pwa.js` — Fuerza que la PWA cargue la última versión desplegada sin tener que quitar y volver a añadir a la pantalla de inicio.
  ↳ marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion, forzarActualizacion, comprobarActualizacion, UPDATE_STEPS
- `recados.js` — Los recados: un emoji y una frase, sacados de lo que está pasando en el viaje.
  ↳ recadosDeDatos, bolsaDeRecados, elegirRecado
- `receta.js` — Una receta con cantidades, y cómo se estira para la gente que hay.
  ↳ normalizarIngredientes, estirar, cifra, loQueSeCompra, partirCantidad, juntarCantidad · +3 más
- `reparto-gente.js` — Entre quién se divide un gasto: los atajos, las familias y el buscador.
  ↳ genteDeAtajo, atajoDe, porFamilias, estadoDeFamilia, quienDeFamilia, buscarGente · +4 más
- `reparto.js` — Motor de reparto — el corazón de Ballena Ops (§3, §14.7 del spec).
  ↳ splitCents, expensePersonShares, expenseFamilyShares, computeFamilyBalances, simplifyDebts
- `salida.js` — Salir de la cuenta sin llevarse por delante lo que todavía no ha subido.
  ↳ comprobarAntesDeSalir, avisoDeSalida
- `scrollLock.js` — Bloqueo del scroll del fondo mientras hay un modal abierto.
  ↳ bloquearScrollDeFondo, liberarScrollDeFondo, useBloqueoDeScroll
- `sincronizarTodo.js` — Inyectada por Vite.
  ↳ informeDelFallo, sincronizarTodo, MOTIVOS
- `sol.js` — A qué hora sale y se pone el sol, y en qué punto del día estamos.
  ↳ solDelDia, momentoDelDia, enPalabras, LAT, LON
- `stats.js` — Estadísticas del evento (§7).
  ↳ computeStats
- `tamano.js` — Tamaño del texto, por dispositivo.
  ↳ getTamano, setTamano, applyTamano, useTamano, TAMANOS
- `tanda.js` — Cuándo se pide la tanda de recadillos, y dónde se guarda mientras tanto.
  ↳ leerTanda, asegurarTanda, olvidarTandas, VENTANA_MS, LATIDO_MS, tocaPedir
- `tema.js` — El tema, que ahora es **uno solo** con sus dos caras.
  ↳ getTema, setTema, applyTema, useTema, TEMAS

**`app/src/screens/`**

- `AccesoScreen.jsx` — Puerta de entrada al grupo.
  ↳ CADA
- `AgendaScreen.jsx` — «Agenda», partida en tres áreas (opciones A1 y B2 de `docs/diseño/navegacion.html`; la tercera llegó después, desde Ajustes).
- `BalancesScreen.jsx` — Saldos: cuánto debe cada familia y quién paga a quién.
- `BienvenidaScreen.jsx` — Lo que se ve la primera vez que entras, mientras baja lo del grupo.
- `CenasScreen.jsx` — Las cenas del viaje: qué se come cada día y en qué bunga, mayores y niños.
- `ComidasScreen.jsx` — «Comidas», con tres áreas (opciones A1, C1 y D1 de `docs/diseño/navegacion.html`).
- `CompraScreen.jsx` — La lista de la compra: lo que sale de las recetas y lo que se apunta a mano.
- `CuentasSection.jsx` — Las cuentas que han pedido entrar, y con quién es cada una.
  ↳ useCuentas, NotificacionesSection, IASection
- `DiasScreen.jsx` — «Días»: la lista de días del evento, con un resumen de cada uno.
- `DineroScreen.jsx` — «Dinero» une las dos caras de lo económico: metes el gasto y ves quién debe a quién sin cambiar de pestaña.
- `EventSettingsScreen.jsx` — Lo que la lista terminada se queda en pantalla antes de recargar, para poder leerla.
  ↳ motivoDelOta, EditorEvento, otaFueBien
- `EventsScreen.jsx` — La lista de eventos: cuál está activo, y crear o editar uno.
- `ExpensesScreen.jsx` — «19:40» — desempata dos gastos de la misma categoría el mismo día.
- `FichaDeGasto.jsx` — La ficha de un gasto (SPECS §14.26 · `docs/diseño/gasto-nuevo.html`, combinación A1 · B3 · C1 · D2 · E2).
  ↳ cuadrar, DetallesDeGasto
- `GrupoSection.jsx` — El grupo en una sola sección: una ficha por familia, con su bunga y su gente.
- `HojaDeEntre.jsx` — Entre quién se divide (SPECS §14.27 · `docs/diseño/gasto-entre.html`, combinación A3 · B2 · C2 con el renglón de C4 · D2 + D4, y E1 en vez de E2).
- `HoyScreen.jsx` — «Hoy»: qué pasa hoy, contestado sin que haya que leer.
- `IdeasScreen.jsx` — «Ideas»: lo que se repite de un viaje a otro.
- `MejorasSection.jsx` — «Mejoras»: el roadmap de la app, apuntado desde el móvil.
- `PlanesConAreasScreen.jsx` — «Planes», partido en dos áreas: lo de este viaje y el catálogo.
- `PlanesScreen.jsx` — Planes: lo que se propone para este viaje, y a qué se apunta cada uno.
- `PlatosScreen.jsx` — «Platos»: el catálogo, que hasta ahora no tenía pantalla.
- `StatsScreen.jsx` — Estadísticas del evento: el gasto, las cenas y los planes, contados.

**`app/src/sync/`**

- `api.js` — Transporte contra la API propia (Worker + D1).
  ↳ hayApi, PLAZO_API, traerInstantanea, enviarCambios, listarCuentas, gestionarCuenta · +19 más
- `engine.js` — El orquestador de la sincronización: cuándo se sube la cola y se baja la instantánea.
  ↳ ultimaSincronizacion, syncNow, useSyncEngine
- `tables.js` — Tablas que se sincronizan (todo lo que es "hecho" del grupo).
  ↳ SYNC_TABLES

**`api/src/`**

- `administrador.js` — Quién administra, y cómo se le reconoce sin que nadie le abra la puerta.
  ↳ normalizarNombre, esCorreoDelAdministrador, esNombreDelAdministrador, ADMINISTRADOR
- `apns.js` — El transporte hasta el teléfono: APNs con autenticación por token.
  ↳ hayApnsConfigurado, tokenDeProveedor, enviarAviso, olvidarTokenDeProveedor
- `apple.js` — Verificación del token de identidad de Sign in with Apple.
  ↳ base64urlADatos, verificarTokenDeApple
- `avisos.js` — A quién le importa lo que acaba de pasar, y qué se le dice.
  ↳ importe, familiasDeUnGasto, elGastoMueveElSaldo, avisoDeGasto, avisoDeLiquidacion, avisoDeEstado · +3 más
- `cantidades.js` — Cuánto de cada ingrediente, y en qué se compra.
  ↳ materialDelPlato, leerCantidades, pedirCantidades, INSTRUCCION
- `cocina.js` — Con qué se cocina en este viaje (SPECS §14.20-quater).
  ↳ COCINA_DE_ORIGEN, cocinaDe, renglonDeCocina
- `encargos.js` — Lo que se le pide al modelo, en un sitio y por escrito.
  ↳ encargosDe, modelosDe, encargosPublicos, ENCARGOS, claveDeEncargo, claveDeModelo · +1 más
- `estados.js` — Los estados de una persona: «🍺 de resaca», «🏖️ tirado en la toalla».
  ↳ materialDeEstados, materialDeUnEstado, leerEstados, leerUnEstado, pedirEstados, pedirGracia · +3 más
- `ia.js` — Los dos servicios de la pantalla de IA: **qué modelos hay** y **si la clave vale**.
  ↳ listarModelos, masCercano, conModeloVigente, probar
- `idea.js` — El encargo del botón «Mejorarla» del editor de una idea (SPECS §14.24).
  ↳ materialDeLaIdea, leerMejora, pedirMejora, INSTRUCCION_MEJORAR
- `index.js` — API de Ballena Ops sobre Cloudflare Workers y D1. 🐳
  ↳ default
- `migraciones.js` — Generado por `herramientas/generar-migraciones.mjs` — no editar a mano.
  ↳ MIGRACIONES
- `migrador.js` — Poner la base al día desde el propio Worker (SPECS §14.23).
  ↳ sentencias, objetivo, estadoDeMigraciones, aplicarMigracion
- `recados.js` — Una tanda de recados para el viaje: un emoji y una frase corta, con gracia.
  ↳ retratoDelGrupo, materialDelViaje, leerRecados, pedirRecados, sigueSirviendo, POR_TANDA · +2 más
- `receta.js` — Los dos encargos del editor de una receta (SPECS §14.20-bis).
  ↳ materialDeLaLista, materialDelPlatoParecido, leerArreglo, leerParecidos, pedirArreglo, pedirParecidos · +2 más
- `repositorio.js` — Lectura y escritura del registro del grupo sobre D1.
  ↳ cuentaPorApple, cuentaPorId, hayAlgunaCuenta, crearCuenta, listarCuentas, enlazarCuentaConPersona · +30 más
- `revocacion.js` — Revocación del token de Sign in with Apple al darse de baja.
  ↳ hayRevocacionConfigurada, secretoDeCliente, revocarEnApple
- `sesion.js` — Sesión propia: un JWT HS256 corto que el dispositivo presenta en cada petición.
  ↳ emitirSesion, emitirPaseDeEspera, verificarPaseDeEspera, verificarSesion, coincideEnTiempoConstante
- `sugerencias.js` — Cinco planes propuestos para un viaje.
  ↳ retratoDelGrupo, materialDelViaje, leerPropuestas, pedirPropuestas, INSTRUCCION
- `tablas.js` — Descripción de las tablas sincronizadas: qué columnas tiene cada una y cuáles necesitan conversión al cruzar la frontera entre SQLite y JavaScript.
  ↳ filaAObjeto, objetoAColumnas, COLUMNAS_COMUNES, TABLAS, NOMBRES, existeTabla

**`api/herramientas/`**

- `datos-ejemplo.mjs` — El evento de prueba «Ballenita 2026», en un fichero aparte para que también lo puedan usar las pruebas: así se garantiza que estos datos siguen entrando en el esquema real y saliendo íntegr…
  ↳ instantaneaDeEjemplo
- `generar-migraciones.mjs` — Copia las migraciones de `migraciones/*.sql` a `src/migraciones.js`, para que el Worker las lleve dentro.
- `sembrar-desde-jsonbin.mjs` — Trae el documento que el grupo tiene en JSONBin y lo siembra en la base nueva.
- `sembrar-ejemplo.mjs` — Siembra la base con el evento de ejemplo «Ballenita 2026», para poder probar la app con datos antes de que entren los de verdad.

**`api/test/`**

- `d1.js` — Adaptador mínimo de D1 sobre `node:sqlite`, para poder probar el repositorio contra el esquema de verdad en lugar de contra un doble de mentira.
  ↳ baseDePrueba

**`app/scripts/`**

- `appdelegate.mjs` — El puente entre APNs y el plugin de avisos, que vive en `AppDelegate.swift`.
  ↳ conAvisosDeRegistro, MARCA
- `entitlements.mjs` — El permiso de avisos del binario, que son **dos** cosas y no una.
  ↳ conPermisoDeAvisos, conEntitlementEnProyecto, APS_ENVIRONMENT, ENTITLEMENTS_NUEVO
- `iconos-web.mjs` — Los iconos de la web y de la PWA, sacados de `assets/icon.png`.
- `patch-ios.mjs` — Aplica al proyecto iOS generado por Capacitor lo que no cabe en la web: el fix del rebote (rubber-band) del scroll, la declaración de que esto es una app de iPhone, el cumplimiento de expor…
- `revision-de-avisos.mjs` — Lo que tiene que estar puesto en el binario para que los avisos existan, leído **después** de haberlo escrito.
  ↳ revisionDeAvisos, lineasDeRevision

**`herramientas/`**

- `escaner.mjs` — Escáner léxico de JavaScript: separa el código de sus comentarios y literales.
  ↳ escanear, cabecera, prosa, primeraFrase, simbolosPublicos, literalDe · +2 más
- `mapa.mjs` — Compone el mapa del repositorio leyendo el código, no un resumen escrito a mano. 🐳

## Qué parte del spec implementa cada módulo

Leído de las citas que los comentarios del código hacen a `docs/SPECS.md`.

- **§3** Gastos — "Modo Splitwise" 💸 → `reparto.js`
- **§3.2** Cómo se divide el gasto → `reparto.js`
- **§3.3** Splits predefinidos por familia (el requisito clave) ⭐ → `BalancesScreen.jsx`, `reparto.js`
- **§3.4** Saldos y liquidación → `reparto.js`
- **§3.6** Multi-moneda (decidido, con letra pequeña) → `money.js`
- **§4** Planes 🗺️ → `db.js`
- **§6** Cenas 🍳 → `db.js`
- **§6.2** Platos predefinidos → `db.js`
- **§6.4** Bungas en las comidas — rotación diaria mayores / niños ⭐ → `stats.js`
- **§6.6** Lista de la compra compartida (manual) 🛒 ⭐ → `db.js`
- **§7** Estadísticas 📊 → `StatsScreen.jsx`, `stats.js`
- **§12.2** Offline-first ⭐ → `ids.js`
- **§14** Arquitectura técnica (PWA) → `db.js`, `ids.js`
- **§14.3** ⚠️ Safari iOS — confirmado por counter-ops → `engine.js`
- **§14.7** ✅ Veredicto de viabilidad — ¿aguanta el modelo de counter-ops? → `reparto.js`
- **§14.9** ⚠️ Migración a backend propio (Worker + D1) — **sustituye a 14.2, 14.5-bis y 14.5-ter** → `BienvenidaScreen.jsx`, `CenasScreen.jsx`, `CuentasSection.jsx`, `EventSettingsScreen.jsx`, `MejorasSection.jsx`, `ProgresoModal.jsx` · +12 más
- **§14.10** Cromo de la app: cabecera, barra inferior y modales → `App.jsx`, `DiasScreen.jsx`, `EventSettingsScreen.jsx`, `PlanesScreen.jsx`, `scrollLock.js`, `stats.js`
- **§14.11** Tipografía: un número y toda la escala → `BalancesScreen.jsx`
- **§14.13** Los dibujos, y el único color que informa → `StatsScreen.jsx`, `categorias.js`, `personas.js`, `pwa.js`
- **§14.14** El grupo: una ficha por familia, y la hoja que sube desde abajo → `Confirmar.jsx`, `EventSettingsScreen.jsx`, `GrupoSection.jsx`, `PlatosScreen.jsx`, `borrados.js`, `evento.js` · +1 más
- **§14.15** Quién entra: la sala de espera, las cuentas y los avisos → `index.js`
- **§14.16** La IA: la clave vive en el servidor → `api.js`, `cocina.js`, `encargos.js`, `ia.js`, `index.js`, `receta.js` · +1 más
- **§14.18** El día es el de aquí, no el de Greenwich → `db.js`
- **§14.19** La versión, abajo y tocable → `ExpensesScreen.jsx`, `IdeasScreen.jsx`, `MejorasSection.jsx`, `PlanesScreen.jsx`, `PlatosScreen.jsx`, `api.js` · +8 más
- **§14.20** Recetas con cantidades, y la compra que sale de ellas → `CenasScreen.jsx`, `CompraScreen.jsx`, `EventSettingsScreen.jsx`, `PlatosScreen.jsx`, `api.js`, `borrados.js` · +6 más
- **§14.21** El día del viaje: qué bungas, qué se cena y qué plan → `db.js`
- **§14.22** Mejoras: el roadmap de la app, apuntado desde el móvil → `Icono.jsx`, `db.js`, `index.js`, `repositorio.js`, `tablas.js`
- **§14.23** Poner la base al día desde Ajustes, cuando va por detrás del código → `EventSettingsScreen.jsx`, `api.js`, `index.js`, `migraciones.js`, `migrador.js`
- **§14.24** El editor de una idea: centrado, sin teclado encima, y con «Mejorarla» → `DiasScreen.jsx`, `FichaDeGasto.jsx`, `IdeasScreen.jsx`, `api.js`, `idea.js`, `index.js`
- **§14.25** Que se note que es verano: el sol de la cabecera y los recados → `App.jsx`, `CenasScreen.jsx`, `CompraScreen.jsx`, `ExpensesScreen.jsx`, `HoyScreen.jsx`, `PlatosScreen.jsx` · +3 más
- **§14.26** Apuntar un gasto en la puerta del súper: sin teclado, y con la cuenta hecha → `FichaDeGasto.jsx`, `HojaDeEntre.jsx`, `PadDeImporte.jsx`, `avisos.js`, `borrados.js`, `importe.js` · +2 más
- **§14.27** Entre quién se divide: cuatro atajos, las familias, y salir sin guardar → `Confirmar.jsx`, `DiasScreen.jsx`, `HojaDeEntre.jsx`, `Icono.jsx`, `reparto-gente.js`
- **§14.28** El mapa del repositorio, compuesto leyendo el código → `native.js`
- **§14.29** La puerta, la sala de espera y el primer arranque tras ser aceptado → `AccesoScreen.jsx`, `App.jsx`
- **§14.30** El día abierto: el mueble de un plan, y cada toque escribe → `DiasScreen.jsx`
- **§14.31** Los elegidores del día: al centro, con borrador y buscador → `HojaDeEstado.jsx`, `StatsScreen.jsx`, `stats.js`
- **§14.34** Cada versión se describe a sí misma → `EventSettingsScreen.jsx`, `notas.js`
- **§14.36** Tu estado, en la cabecera → `HoyScreen.jsx`, `PastillaDeEstado.jsx`, `api.js`, `estados.js`, `index.js`
- **§14.37** La marca es el icono, y el rojo se reserva para lo que falla → `EventSettingsScreen.jsx`
- **§14.39** De qué avisarte, y no avisarte de lo tuyo → `CuentasSection.jsx`, `api.js`, `index.js`
