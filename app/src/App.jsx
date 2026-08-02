import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import AccesoScreen from './screens/AccesoScreen.jsx'
import EventsScreen from './screens/EventsScreen.jsx'
import AgendaScreen from './screens/AgendaScreen.jsx'
import DineroScreen from './screens/DineroScreen.jsx'
import CenasCompraScreen from './screens/CenasCompraScreen.jsx'
import PlanesScreen from './screens/PlanesScreen.jsx'
import EventSettingsScreen from './screens/EventSettingsScreen.jsx'
import SyncDot from './components/SyncDot.jsx'
import ProgresoModal from './components/ProgresoModal.jsx'
import { sincronizarTodo } from './lib/sincronizarTodo.js'
import { useSyncEngine } from './sync/engine.js'
import { isNative, tap } from './lib/native.js'
import { veniaDeActualizar } from './lib/pwa.js'
import { cargarConfiguracion, estaConfigurada } from './lib/config.js'
import { enDemo, salirDemo } from './lib/demo.js'
import { haySesion, leerSesion, modoLocal } from './auth/sesion.js'

const ACTIVE_KEY = 'ballena.activeEventId'

// 5 destinos en la barra (≤5, iOS HIG / Material). Gastos+Saldos se funden en
// «Dinero» y la Compra entra en «Cenas».
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
  { id: 'hoy', label: 'Hoy', icon: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4' },
  { id: 'dinero', label: 'Dinero', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'cenas', label: 'Cenas', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'planes', label: 'Planes', icon: 'M12 22s-7-6-7-12a7 7 0 1114 0c0 6-7 12-7 12z' },
  { id: 'ajustes', label: 'Ajustes', icon: 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM19.4 15a1.6 1.6 0 00.32 1.77l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.6 1.6 0 00-2.77 1.15V21a2 2 0 11-4 0v-.11a1.6 1.6 0 00-2.77-1.09l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.6 1.6 0 003.11 14H3a2 2 0 110-4h.11a1.6 1.6 0 001.15-2.77l-.06-.06a2 2 0 112.83-2.83l.06.06A1.6 1.6 0 0010 3.11V3a2 2 0 114 0v.11a1.6 1.6 0 002.77 1.15l.06-.06a2 2 0 112.83 2.83l-.06.06A1.6 1.6 0 0020.89 10H21a2 2 0 110 4h-.11a1.6 1.6 0 00-1.49 1z' },
]

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  // Tras recargar por una actualización volvemos a Ajustes en vez de a «Hoy»,
  // para no perder el sitio desde el que se pulsó el botón.
  const [tab, setTab] = useState(() => (veniaDeActualizar() ? 'ajustes' : 'hoy'))

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
    setTab('hoy')
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

      {tab === 'hoy' && <AgendaScreen eventId={activeId} event={event} onGoTab={setTab} />}
      {tab === 'dinero' && <DineroScreen eventId={activeId} event={event} />}
      {tab === 'cenas' && <CenasCompraScreen eventId={activeId} event={event} />}
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
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
