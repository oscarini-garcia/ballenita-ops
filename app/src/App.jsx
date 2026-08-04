import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import AccesoScreen from './screens/AccesoScreen.jsx'
import EventsScreen from './screens/EventsScreen.jsx'
import AgendaScreen from './screens/AgendaScreen.jsx'
import DineroScreen from './screens/DineroScreen.jsx'
import ComidasScreen from './screens/ComidasScreen.jsx'
import PlanesScreen from './screens/PlanesConAreasScreen.jsx'
import EventSettingsScreen from './screens/EventSettingsScreen.jsx'
import Icono from './components/Icono.jsx'
import SyncDot from './components/SyncDot.jsx'
import LineaDelHorizonte from './components/LineaDelHorizonte.jsx'
import ProgresoModal from './components/ProgresoModal.jsx'
import { sincronizarTodo } from './lib/sincronizarTodo.js'
import { useSyncEngine } from './sync/engine.js'
import { isNative, tap } from './lib/native.js'
import { veniaDeActualizar } from './lib/pwa.js'
import { cargarConfiguracion, estaConfigurada } from './lib/config.js'
import { enDemo, salirDemo } from './lib/demo.js'
import { asegurarPush } from './lib/push.js'
import { LATIDO_MS, asegurarTanda } from './lib/tanda.js'
import { haySesion, leerSesion, modoLocal } from './auth/sesion.js'

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
// Ajustes es el quinto y va **aquí abajo a la derecha**, no en la esquina de la
// cabecera, donde estuvo. Arriba a la derecha es lo que peor alcanza el pulgar de
// una mano sola, y es justo el sitio al que hay que estirarse cuando algo no va.
// Abajo cuesta un toque cómodo — y de paso deja la cabecera para el punto de
// sincronización y tu nombre. Es la misma resolución que en `garciadoral-ops`.
//
// Se ha comido lo que era «Más»: las estadísticas eran media pestaña para algo
// que se mira al volver del viaje, y ahora son un apartado de Ajustes.
const TABS = [
  { id: 'agenda', label: 'Agenda', icono: 'evento' },
  { id: 'dinero', label: 'Dinero', icono: 'grafico' },
  { id: 'comidas', label: 'Comidas', icono: 'restaurante' },
  { id: 'planes', label: 'Planes', icono: 'plan' },
  { id: 'ajustes', label: 'Ajustes', icono: 'ajustes' },
]

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  // Tras recargar por una actualización volvemos a Ajustes en vez de a «Hoy»,
  // para no perder el sitio desde el que se pulsó el botón.
  const [tab, setTab] = useState(() => (veniaDeActualizar() ? 'ajustes' : 'agenda'))

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

  const sync = useSyncEngine()

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

  // El identificador de APNs se vuelve a apuntar en cada arranque, con sesión y
  // con el permiso ya concedido. Es lo que Apple espera —el token cambia al
  // reinstalar o restaurar— y es lo que faltaba: el permiso estaba dado, el
  // servidor no tenía a dónde mandar, y el único botón que lo arreglaba se
  // esconde precisamente cuando el permiso está dado. Ver `lib/push.js`.
  useEffect(() => { if (sesion) asegurarPush() }, [sesion])

  // La tanda de recadillos, cada dos horas (SPECS §14.24). La regla la cumple
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

  // Solo si el evento activo se ha resuelto a "no existe" (borrado), volver a la lista.
  useEffect(() => {
    if (activeId && resolvedForActive && event === null) pick(null)
  }, [activeId, resolvedForActive, event])

  // Hasta saber si esta instalación tiene API no se puede decidir si hace falta
  // entrar; pintar la app y quitarla un instante después sería peor.
  if (configuracion === undefined) {
    return (
      <div className="app">
        <div className="body"><div className="empty"><span className="e">🐳</span>Cargando…</div></div>
      </div>
    )
  }

  // Solo la app de iOS entra: la sincronización con el grupo vive en la cáscara
  // nativa. En el navegador y en la PWA instalada, Ballena Ops es una libreta
  // local de ese dispositivo y no pide nada.
  if (isNative() && estaConfigurada(configuracion) && !sesion && !soloLocal && !demo) {
    return (
      <div className="app">
        <AccesoScreen
          configuracion={configuracion}
          onEntrar={setSesion}
          onLocal={() => setSoloLocal(true)}
          onDemo={(id) => { setDemo(true); if (id) pick(id) }}
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
          <div className="su">{event.lugar || 'Ballena Ops'}</div>
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
          /* El punto vuelve a la cabecera, y ahora es el botón de sincronizarlo
             todo: los datos del grupo y, detrás, la versión de la app. Los
             ajustes se han ido abajo a la derecha, que es donde llega el pulgar. */
          <SyncDot sync={sync} onClick={sincronizarTodoAhora} />
        )}
      </header>

      {/* El día, dibujado en tres puntos bajo la cabecera. Ver SPECS §14.24. */}
      <LineaDelHorizonte />

      {tab === 'agenda' && <AgendaScreen eventId={activeId} event={event} onGoTab={setTab} />}
      {tab === 'dinero' && <DineroScreen eventId={activeId} event={event} />}
      {tab === 'comidas' && <ComidasScreen eventId={activeId} event={event} />}
      {tab === 'planes' && <PlanesScreen eventId={activeId} event={event} />}
      {tab === 'ajustes' && (
        <EventSettingsScreen
          eventId={activeId}
          event={event}
          onPickEvent={pick}
          sync={sync}
          onSincronizarTodo={sincronizarTodoAhora}
        />
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => { tap(); setTab(t.id) }}>
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
