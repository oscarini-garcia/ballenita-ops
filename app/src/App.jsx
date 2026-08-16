// El esqueleto de la aplicación: cabecera, cuerpo y barra de cinco destinos.
//
// Es una columna de `100dvh` en la que nada es `position: fixed`, así que nada
// se solapa (SPECS §14.10). Decide también qué se enseña antes de entrar —el
// acceso, la lista de eventos— y monta el motor de sincronización.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent, listEvents } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import AccesoScreen from './screens/AccesoScreen.jsx'
import EnlaceScreen from './screens/EnlaceScreen.jsx'
import BienvenidaScreen from './screens/BienvenidaScreen.jsx'
import EventsScreen from './screens/EventsScreen.jsx'
import AgendaScreen from './screens/AgendaScreen.jsx'
import DineroScreen from './screens/DineroScreen.jsx'
import ComidasScreen from './screens/ComidasScreen.jsx'
import PlanesScreen from './screens/PlanesConAreasScreen.jsx'
import GrupoScreen from './screens/GrupoScreen.jsx'
import EventSettingsScreen from './screens/EventSettingsScreen.jsx'
import Icono from './components/Icono.jsx'
import SyncDot from './components/SyncDot.jsx'
import PastillaDeEstado from './components/PastillaDeEstado.jsx'
import LineaDelHorizonte from './components/LineaDelHorizonte.jsx'
import ProgresoModal from './components/ProgresoModal.jsx'
import { sincronizarTodo } from './lib/sincronizarTodo.js'
import { primeraBajada } from './lib/primeraBajada.js'
import { LATIDO_DATOS_MS, useSyncEngine, ultimaSincronizacion } from './sync/engine.js'
import { checkForOtaUpdate, escucharToquesDeAviso, hayOtaNueva, isNative, tap } from './lib/native.js'
import { creaVigilante } from './lib/vigilante.js'
import { veniaDeActualizar } from './lib/pwa.js'
import { cargarConfiguracion, estaConfigurada } from './lib/config.js'
import { enDemo, salirDemo } from './lib/demo.js'
import { asegurarPush } from './lib/push.js'
import { LATIDO_MS, asegurarTanda } from './lib/tanda.js'
import { ponerArea } from './lib/areas.js'
import { destinoDeAviso, guardarDestino, tomarDestino } from './lib/destino.js'
import { guardarSesion, haySesion, leerSesion, modoLocal } from './auth/sesion.js'
import { canjearEnlace, limpiarLaUrl, paseDeLaUrl } from './auth/enlace.js'

const ACTIVE_KEY = 'ballena.activeEventId'

// 5 destinos en la barra (≤5, iOS HIG / Material), y cada uno partido en áreas
// con un mando bajo la cabecera. Ver `docs/diseño/navegacion.html`, opción A1.
//
// **El rótulo nombra la sección, no su primera área.** La primera pestaña se
// llamaba «Hoy» y ahora se llama «Agenda»: una pestaña «Hoy» que contiene un
// área «Hoy» deja de decir dónde estás para decir dónde estabas al entrar. Se
// paga que el destino más visitado pierda la palabra más corta y más urgente
// —«Hoy» son 28 pt y «Agenda» 55—, y se paga una vez, el primer día.
//
// Y «Cenas» pasa a ser «Comidas»: el modelo solo tiene cenas y dentro se siguen
// llamando cenas, pero el rótulo deja sitio a las comidas de mediodía sin volver
// a tocar la navegación. Es el rótulo más largo de la barra (61,7 pt de 76,4) y
// aguanta incluso en tamaño Enorme.
//
// **El quinto destino es «Grupo», y Ajustes sube a un botón** (SPECS §14.52,
// `docs/diseño/donde-vive-el-grupo.html` · Q2). Durante años el quinto fue
// Ajustes, y dentro tenía nueve acordeones de los que **tres no eran ajustes**:
// «El grupo», «Quién eres» y «Mejoras». Mientras el grupo era un censo se
// aguantaba; al darle al bunga notas e histórico, a cada familia su cacharro y a
// las personas la casilla de quién lleva las cuentas, eso dejó de ajustarse y
// pasó a **mirarse** — que es exactamente lo que sacó a las estadísticas de
// Ajustes en §14.10-ter.
//
// El sitio no se paga con una casilla: Ajustes no tiene mando de áreas, así que
// el cambio es un renombrado. Y Ajustes no desaparece, se va **arriba a la
// derecha en pequeño**, que es donde estuvo antes de §14.10 y donde vuelve a
// tener sentido ahora que lo que queda dentro son seis cosas que casi nunca se
// tocan: aspecto, evento, avisos, cuentas, IA y la app. El argumento de entonces
// —arriba a la derecha es lo que peor alcanza el pulgar— sigue siendo cierto, y
// por eso lo que se queda arriba es lo que menos se pulsa.
const TABS = [
  { id: 'agenda', label: 'Agenda', icono: 'evento' },
  { id: 'dinero', label: 'Dinero', icono: 'grafico' },
  { id: 'comidas', label: 'Comidas', icono: 'restaurante' },
  { id: 'planes', label: 'Planes', icono: 'plan' },
  { id: 'grupo', label: 'Grupo', icono: 'familia' },
]

// Ajustes es un destino más para `tab`, pero **no sale en la barra**: se llega
// por el botón de la cabecera y se sale por él o por cualquier pestaña.
const AJUSTES = 'ajustes'

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  // Tras recargar por una actualización volvemos a Ajustes en vez de a «Hoy»,
  // para no perder el sitio desde el que se pulsó el botón.
  const [tab, setTab] = useState(() => (veniaDeActualizar() ? AJUSTES : 'agenda'))
  // A dónde vuelve el aspa de la cabecera. Ajustes ya no es una pestaña, así que
  // salir tiene que devolverte a donde estabas y no a un sitio por defecto.
  const [volverA, setVolverA] = useState('agenda')
  // La fila que hay que abrir al llegar desde un aviso, o null. Se pasa a la
  // pantalla de destino y ella la consume (§14.60 · R2).
  const [abrirFila, setAbrirFila] = useState(null)

  // `undefined` mientras se lee config.json; después, el objeto (vacío si no
  // hay API configurada, que es el modo solo-local de siempre).
  const [configuracion, setConfiguracion] = useState(undefined)
  const [sesion, setSesion] = useState(() => leerSesion())
  // Quien no puede entrar con Apple sigue en local (ver AccesoScreen). Es una
  // decisión de este móvil, así que se recuerda y no se vuelve a preguntar.
  const [soloLocal, setSoloLocal] = useState(modoLocal)
  // La demostración abre la puerta igual, pero **no** se recuerda entre
  // arranques y lo que siembra se borra al salir. Ver `lib/demo.js`.
  const [demo, setDemo] = useState(enDemo)
  useEffect(() => { cargarConfiguracion().then(setConfiguracion) }, [])

  // Un enlace de acceso en la URL (SPECS §14.61). Se mira **al construir** y no
  // en un efecto: mientras haya pase, esta pantalla es la del enlace, y pintar
  // la app un instante antes de quitarla se lee como que el enlace no ha hecho
  // nada. `null` es que no hay ninguno, que es el caso de siempre.
  const [enlace, setEnlace] = useState(() => (paseDeLaUrl() ? { estado: 'yendo' } : null))

  // Si hay sesión pero este móvil no ha sincronizado **nunca**, lo que viene
  // ahora es la primera bajada y hay que contarla (SPECS §14.29 · C2). Se
  // decide una sola vez al arrancar: en cuanto se entra, se apaga.
  const [bienvenida, setBienvenida] = useState(() => Boolean(leerSesion()) && !ultimaSincronizacion())

  const sync = useSyncEngine(sesion)

  /**
   * Canjear el enlace de acceso por una sesión (SPECS §14.61).
   *
   * Espera a `configuracion` porque de ahí sale la dirección de la API, y se
   * dispara otra vez cuando el estado vuelve a `yendo`, que es lo que hace el
   * botón de reintentar cuando lo que falló fue la red.
   *
   * La URL se limpia con la respuesta y **no antes**: un fallo de red tiene que
   * poder reintentarse recargando, y el pase sigue vivo porque el servidor solo
   * lo quema al canjearlo de verdad. Sale de la demostración antes de entrar
   * —lo sembrado es inventado y tiene su cola de cambios detrás—: sin eso, abrir
   * el enlace desde una demostración le subiría al grupo un camping que no
   * existe.
   */
  useEffect(() => {
    if (!configuracion || enlace?.estado !== 'yendo') return undefined
    const pase = paseDeLaUrl()
    if (!pase) { setEnlace(null); return undefined }

    let vivo = true
    ;(async () => {
      const respuesta = await canjearEnlace(configuracion, pase)
      if (!vivo) return
      if (respuesta.estado === 'sin-respuesta') { setEnlace(respuesta); return }

      limpiarLaUrl()
      if (respuesta.estado !== 'dentro') { setEnlace(respuesta); return }

      if (enDemo()) { await salirDemo(); setDemo(false) }
      guardarSesion(respuesta)
      setSesion(respuesta)
      setBienvenida(true)
      setEnlace(null)
    })()
    return () => { vivo = false }
  }, [configuracion, enlace?.estado])

  // Sincronizar todo: los datos y, detrás, la versión de la app. Vive en App
  // porque lo disparan dos sitios —el punto de la cabecera y el botón de
  // Ajustes— y el modal de progreso tiene que ser el mismo.
  const [pasosSync, setPasosSync] = useState(null)
  const [syncEnCurso, setSyncEnCurso] = useState(false)

  // `alAvanzar` deja que quien lo dispara elija dónde se pinta: el punto de la
  // cabecera abre su modal —allí un toque sin respuesta a la vista no diría
  // nada—, y Ajustes lo cuenta en su sitio, debajo del botón, donde se queda.
  async function sincronizarTodoAhora({ alAvanzar } = {}) {
    if (syncEnCurso) return
    setSyncEnCurso(true)
    const enModal = !alAvanzar
    if (enModal) setPasosSync([])
    await sincronizarTodo({
      sincronizarDatos: sync.recheck,
      alAvanzar: alAvanzar ?? setPasosSync,
    })
    setSyncEnCurso(false)
  }

  /**
   * **Tocar un aviso abre lo que lo generó** (SPECS §14.60).
   *
   * Tres cosas, y las tres hacen falta:
   *
   *  · **la fila y no solo la pestaña** (R2) — el destino viene como
   *    `pestaña/área/fila` y la pantalla de llegada lo abre.
   *  · **el evento** (R3) — un aviso de un viaje que no es el que tienes
   *    abierto llevaría a una pantalla donde esa fila no existe, y eso se lee
   *    como que la app se ha perdido. Se cambia **antes** de navegar.
   *  · **con la app cerrada** (R4) — el toque llega antes de que haya nada
   *    montado, así que el destino se guarda y se consume cuando ya se puede.
   *    Sin esto funcionaría con la app abierta y fallaría justo cuando más se
   *    usa, que es a las ocho de la mañana con el teléfono en la mesilla.
   */
  useEffect(() => escucharToquesDeAviso((datos) => {
    const destino = destinoDeAviso(datos)
    if (destino) guardarDestino(destino)
  }), [])

  // El identificador de APNs se vuelve a apuntar en cada arranque, con sesión y
  // con el permiso ya concedido. Es lo que Apple espera —el token cambia al
  // reinstalar o restaurar— y es lo que faltaba: el permiso estaba dado, el
  // servidor no tenía a dónde mandar, y el único botón que lo arreglaba se
  // esconde precisamente cuando el permiso está dado. Ver `lib/push.js`.
  useEffect(() => { if (sesion) asegurarPush() }, [sesion])

  // La tanda de recadillos, cada dos horas (SPECS §14.25). La regla la cumple
  // `asegurarTanda`: aquí solo se le pregunta —al entrar en el evento, al volver
  // del fondo y cada cinco minutos— y ella decide si ya tocaba. Un latido corto
  // con una ventana larga es lo que hace que valga igual con la app abierta toda
  // la tarde que abriéndola una vez al día.
  useEffect(() => {
    if (!activeId) return undefined
    const mirar = () => { asegurarTanda(activeId) }
    mirar()
    const reloj = setInterval(mirar, LATIDO_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') mirar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver) }
  }, [activeId])

  // La versión de la app, con la misma figura y el mismo minuto que los datos
  // (SPECS §14.46): se **pregunta** cada latido —un JSON de 204 bytes— y se
  // **pone** al volver a primer plano, que es cuando una recarga no le quita a
  // nadie un gasto a medio escribir. Quién decide qué, en `lib/vigilante.js`.
  useEffect(() => {
    const vigilante = creaVigilante({
      hayNueva: hayOtaNueva,
      aplicar: () => checkForOtaUpdate({ aplicarYa: true }),
    })
    vigilante.comprobar()
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') vigilante.comprobar()
    }, LATIDO_DATOS_MS)
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      vigilante.comprobar()
      vigilante.aplicarSiToca()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver) }
  }, [])

  // Si el Worker rechaza la sesión, el transporte ya la ha borrado: aquí solo
  // hay que volver a la puerta.
  useEffect(() => {
    if (sync.status === 'sesion-caducada' && !haySesion()) setSesion(null)
  }, [sync.status])

  // El resultado se etiqueta con el id consultado, para distinguir un valor "stale"
  // (de un activeId anterior, aún sin resolver) de un "el evento no existe" real.
  const result = useLiveQuery(
    async () => ({ forId: activeId, ev: activeId ? ((await getEvent(activeId)) ?? null) : null }),
    [activeId],
  )
  const resolvedForActive = result && result.forId === activeId
  const event = resolvedForActive ? result.ev : undefined // undefined = cargando/stale

  function pick(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
    setActiveId(id)
    setTab('agenda')
  }

  /**
   * Al terminar la primera bajada, si el grupo tiene **un solo** evento se entra
   * en él sin preguntar (SPECS §14.29 · C4).
   *
   * En este grupo hay uno, siempre: la lista de eventos con una sola fila es una
   * pregunta cuya respuesta ya se sabe. Con dos o más se enseña la lista, que es
   * lo que hay que hacer entonces — el atajo se retira solo el día que deje de
   * ser cierto, en vez de llevar a un evento que a lo mejor no es el que quieres.
   */
  async function entrarEnLoQueHaya() {
    setBienvenida(false)
    if (activeId) return
    const eventos = await listEvents().catch(() => [])
    if (eventos.length === 1) pick(eventos[0].id)
  }

  // Solo si el evento activo se ha resuelto a "no existe" (borrado), volver a la lista.
  useEffect(() => {
    if (activeId && resolvedForActive && event === null) pick(null)
  }, [activeId, resolvedForActive, event])

  // Y se consume aquí, ya con el evento resuelto: es el momento en que la
  // pantalla de llegada puede encontrar su fila.
  useEffect(() => {
    if (!event) return
    const destino = tomarDestino()
    if (!destino) return
    if (destino.eventId && destino.eventId !== activeId) {
      // Volverá a entrar cuando el evento nuevo esté resuelto.
      guardarDestino(destino)
      pick(destino.eventId)
      return
    }
    if (destino.area) ponerArea(destino.tab, destino.area)
    setVolverA(destino.tab)
    setTab(destino.tab)
    setAbrirFila(destino.fila ?? null)
  }, [event, activeId])

  // Hasta saber si esta instalación tiene API no se puede decidir si hace falta
  // entrar; pintar la app y quitarla un instante después sería peor.
  if (configuracion === undefined) {
    return (
      <div className="app">
        <div className="body"><div className="empty"><span className="e">🐳</span>Cargando…</div></div>
      </div>
    )
  }

  // Con un enlace de acceso por delante, esto es lo único que hay en pantalla
  // hasta que entre o hasta que se sepa que no puede (SPECS §14.61).
  if (enlace) {
    return (
      <div className="app">
        <EnlaceScreen
          estado={enlace.estado}
          mensaje={enlace.mensaje}
          onReintentar={() => setEnlace({ estado: 'yendo' })}
          onSeguirSinEntrar={() => { limpiarLaUrl(); setEnlace(null) }}
        />
      </div>
    )
  }

  // Por la puerta de Apple entra solo la app de iOS: esa hoja vive en la cáscara
  // nativa. En el navegador se entra con un enlace de acceso (arriba), y sin él
  // Ballena Ops es una libreta local de ese dispositivo y no pide nada.
  if (isNative() && estaConfigurada(configuracion) && !sesion && !soloLocal && !demo) {
    return (
      <div className="app">
        <AccesoScreen
          configuracion={configuracion}
          onEntrar={(s) => { setSesion(s); setBienvenida(true) }}
          onLocal={() => setSoloLocal(true)}
          onDemo={(id) => { setDemo(true); if (id) pick(id) }}
        />
      </div>
    )
  }

  // Recién entrado y sin nada bajado todavía: se cuenta la primera bajada en vez
  // de enseñar una libreta vacía que invita a crear un evento duplicado
  // (SPECS §14.29 · C2). La demostración no pasa por aquí: arranca llena.
  if (bienvenida && sesion && !demo) {
    return (
      <div className="app">
        <BienvenidaScreen
          nombre={sesion.cuenta?.nombre?.split(' ')[0]}
          sincronizar={({ alAvanzar }) => primeraBajada({ sincronizarDatos: sync.sync, alAvanzar })}
          onListo={entrarEnLoQueHaya}
        />
      </div>
    )
  }

  if (!activeId) {
    return (
      <div className="app">
        <EventsScreen onPick={pick} />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="app">
        <div className="body"><div className="empty"><span className="e">🐳</span>Cargando…</div></div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Tres cosas y ni una más: la ballena, dónde estás y el punto.
          El badge de «quién eres» se ha retirado. Decía tu nombre en todas las
          pantallas, todo el rato, en un móvil que es tuyo —una respuesta a una
          pregunta que ya sabías—, y costaba 112 px de una fila que solo tiene
          390: con él, el logotipo y el punto, al nombre del evento le quedaban
          87 px y «Ballenita 2026» se leía «Ballenita 2…». Tu perfil (emoji,
          estado y foto) y el cambio de persona viven ahora en Ajustes → Quién
          eres, que es donde se va cuando de verdad hay algo que cambiar. */}
      <header className="appbar">
        <WhaleLogo className="logo" />
        <div className="grow">
          <div className="ti">{event.name}</div>
          {/* La segunda línea deja de decir el camping —que después del primer
              día es decoración: ya sabes dónde estás— y pasa a ser **tu
              estado**, que se toca (`docs/diseño/estado.html` · A3 · V1). Es
              la única de las tres colocaciones que no le quita un punto de
              ancho al nombre del evento; se paga en alto de la cabecera, de
              78,8 a 94,1. Sin identidad en este móvil vuelve el lugar: no hay
              estado de nadie que enseñar. */}
          <PastillaDeEstado eventId={activeId} lugar={event.lugar} />
        </div>
        {/* En demostración la pastilla **sustituye** al punto, no se suma a él.
            La cabecera tiene sitio para tres cosas y el punto no significa nada
            aquí: en una demostración no hay nada que sincronizar, y enseñarlo en
            verde sería mentir. La pastilla dice lo único que importa —que todo lo
            que se ve es inventado— y es además la salida. */}
        {demo ? (
          <button
            className="pill demo-pill"
            title="Salir de la demostración"
            onClick={async () => { tap(); await salirDemo(); pick(null); setDemo(false) }}
          >
            demostración · salir
          </button>
        ) : (
          /* El punto es el botón de sincronizarlo todo: los datos del grupo y,
             detrás, la versión de la app. */
          <SyncDot sync={sync} onClick={sincronizarTodoAhora} />
        )}
        {/* Y Ajustes, en pequeño (§14.52). El aspa y la rueda son el mismo
            botón porque son el mismo gesto: entrar y salir de lo mismo. Sin
            esto, la única salida de Ajustes sería tocar otra pestaña, y volver
            a donde estabas exigiría acordarse de dónde estabas. */}
        <button
          className="iconbtn"
          aria-label={tab === AJUSTES ? 'Cerrar los ajustes' : 'Ajustes'}
          aria-pressed={tab === AJUSTES}
          onClick={() => {
            tap()
            if (tab === AJUSTES) { setTab(volverA); return }
            setVolverA(tab)
            setTab(AJUSTES)
          }}
        >
          {tab === AJUSTES ? <span className="x-chico" aria-hidden>×</span> : <Icono nombre="ajustes" />}
        </button>
      </header>

      {/* El día, dibujado en tres puntos bajo la cabecera. Ver SPECS §14.25. */}
      <LineaDelHorizonte />

      {/* `abrir` es la fila que trae un aviso tocado, y `onAbierta` la apaga:
          se navega una vez, no en cada pintado. */}
      {tab === 'agenda' && (
        <AgendaScreen
          eventId={activeId}
          event={event}
          onGoTab={setTab}
          abrir={abrirFila}
          onAbierta={() => setAbrirFila(null)}
        />
      )}
      {tab === 'dinero' && (
        <DineroScreen eventId={activeId} event={event} abrir={abrirFila} onAbierta={() => setAbrirFila(null)} />
      )}
      {tab === 'comidas' && <ComidasScreen eventId={activeId} event={event} />}
      {tab === 'planes' && (
        <PlanesScreen eventId={activeId} event={event} abrir={abrirFila} onAbierta={() => setAbrirFila(null)} />
      )}
      {tab === 'grupo' && <GrupoScreen eventId={activeId} event={event} />}
      {tab === AJUSTES && (
        <EventSettingsScreen
          eventId={activeId}
          event={event}
          onPickEvent={pick}
          onGoTab={(id) => { setVolverA(id); setTab(id) }}
          sync={sync}
          onSincronizarTodo={sincronizarTodoAhora}
        />
      )}

      {/* Pulsar **Agenda** lleva a «Días» (§14.47): es el calendario del viaje y
          lo que se viene a mirar. «Hoy» se sigue viendo al abrir la app —ahí no
          hay pulsación, y el titular del día es con lo que se quiere abrir— y a
          un toque en el mando. Las otras cuatro pestañas recuerdan dónde
          estabas, como siempre (`lib/areas.js`). */}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' on' : ''}`}
            onClick={() => {
              tap()
              if (t.id === 'agenda') ponerArea('agenda', 'dias')
              setVolverA(t.id)
              setTab(t.id)
            }}
          >
            <Icono nombre={t.icono} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {pasosSync && (
        <ProgresoModal
          titulo={syncEnCurso ? 'Sincronizando todo' : 'Sincronización terminada'}
          pasos={pasosSync}
          terminado={!syncEnCurso}
          onCerrar={() => setPasosSync(null)}
        />
      )}
    </div>
  )
}
