import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent, personsOf } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import UserBadge from './components/UserBadge.jsx'
import AccesoScreen from './screens/AccesoScreen.jsx'
import EventsScreen from './screens/EventsScreen.jsx'
import AgendaScreen from './screens/AgendaScreen.jsx'
import DineroScreen from './screens/DineroScreen.jsx'
import CenasCompraScreen from './screens/CenasCompraScreen.jsx'
import PlanesScreen from './screens/PlanesScreen.jsx'
import MasScreen from './screens/MasScreen.jsx'
import { useSyncEngine } from './sync/engine.js'
import { isNative, tap } from './lib/native.js'
import { veniaDeActualizar } from './lib/pwa.js'
import { cargarConfiguracion, estaConfigurada } from './lib/config.js'
import { haySesion, leerSesion, modoLocal } from './auth/sesion.js'

const ACTIVE_KEY = 'ballena.activeEventId'

// Opción A de UX: 5 destinos en la barra (≤5, iOS HIG / Material). Gastos+Saldos
// se funden en «Dinero», la Compra entra en «Cenas» y Stats/Ajustes viven en «Más».
const TABS = [
  { id: 'hoy', label: 'Hoy', icon: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4' },
  { id: 'dinero', label: 'Dinero', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'cenas', label: 'Cenas', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'planes', label: 'Planes', icon: 'M12 22s-7-6-7-12a7 7 0 1114 0c0 6-7 12-7 12z' },
  { id: 'mas', label: 'Más', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
]

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  // Tras recargar por una actualización, volvemos a «Más» (donde vive Ajustes) en
  // vez de a «Hoy», para no perder el sitio desde el que se pulsó el botón.
  const [tab, setTab] = useState(() => (veniaDeActualizar() ? 'mas' : 'hoy'))
  // Sub-pestaña de «Más»: la controla App porque el ⚙️ de la cabecera es un
  // atajo directo a Ajustes, no a Estadísticas.
  const [masSeg, setMasSeg] = useState(() => (veniaDeActualizar() ? 'ajustes' : 'stats'))

  // `undefined` mientras se lee config.json; después, el objeto (vacío si no
  // hay API configurada, que es el modo solo-local de siempre).
  const [configuracion, setConfiguracion] = useState(undefined)
  const [sesion, setSesion] = useState(() => leerSesion())
  // Quien no puede entrar con Apple sigue en local (ver AccesoScreen). Es una
  // decisión de este móvil, así que se recuerda y no se vuelve a preguntar.
  const [soloLocal, setSoloLocal] = useState(modoLocal)
  useEffect(() => { cargarConfiguracion().then(setConfiguracion) }, [])

  const sync = useSyncEngine()

  // Si el Worker rechaza la sesión, el transporte ya la ha borrado: aquí solo
  // hay que volver a la puerta.
  useEffect(() => {
    if (sync.status === 'sesion-caducada' && !haySesion()) setSesion(null)
  }, [sync.status])

  const persons = useLiveQuery(() => (activeId ? personsOf(activeId) : []), [activeId], [])

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
  if (isNative() && estaConfigurada(configuracion) && !sesion && !soloLocal) {
    return (
      <div className="app">
        <AccesoScreen
          configuracion={configuracion}
          onEntrar={setSesion}
          onLocal={() => setSoloLocal(true)}
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
      <header className="appbar">
        <WhaleLogo className="logo" />
        <div className="grow">
          <div className="ti">{event.name}</div>
          <div className="su">{event.lugar || 'Ballena Ops'}</div>
        </div>
        {/* Los ajustes son un botón de la cabecera: el estado de sincronización
            ya no vive aquí, se ha mudado dentro de Ajustes. */}
        <button
          className="iconbtn"
          title="Ajustes"
          aria-label="Ajustes"
          onClick={() => { tap(); setMasSeg('ajustes'); setTab('mas') }}
        >
          ⚙️
        </button>
        <UserBadge eventId={activeId} persons={persons} />
      </header>

      {tab === 'hoy' && <AgendaScreen eventId={activeId} event={event} onGoTab={setTab} />}
      {tab === 'dinero' && <DineroScreen eventId={activeId} event={event} />}
      {tab === 'cenas' && <CenasCompraScreen eventId={activeId} event={event} />}
      {tab === 'planes' && <PlanesScreen eventId={activeId} event={event} />}
      {tab === 'mas' && (
        <MasScreen
          eventId={activeId}
          event={event}
          onChangeEvent={() => pick(null)}
          seccion={masSeg}
          onSeccion={setMasSeg}
          sync={sync}
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
    </div>
  )
}
