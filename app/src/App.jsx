import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import EventsScreen from './screens/EventsScreen.jsx'
import ExpensesScreen from './screens/ExpensesScreen.jsx'
import BalancesScreen from './screens/BalancesScreen.jsx'
import EventSettingsScreen from './screens/EventSettingsScreen.jsx'
import CenasScreen from './screens/CenasScreen.jsx'
import PlanesScreen from './screens/PlanesScreen.jsx'
import CompraScreen from './screens/CompraScreen.jsx'
import AgendaScreen from './screens/AgendaScreen.jsx'
import StatsScreen from './screens/StatsScreen.jsx'
import { useSyncEngine } from './sync/engine.js'
import { tap, share } from './lib/native.js'

const APP_URL = 'https://oscarini-garcia.github.io/ballenita-ops/'
// Inyectada por Vite (define). Guarda por si el global no existe (p. ej. en algún test).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

const ACTIVE_KEY = 'ballena.activeEventId'

const SYNC_LABEL = {
  'no-config': '● local', syncing: '↻ …', synced: '✓ sync', offline: '⚠ sin red',
  error: '⚠ error', busy: '↻ …', idle: '● local',
}

const TABS = [
  { id: 'agenda', label: 'Agenda', icon: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4' },
  { id: 'gastos', label: 'Gastos', icon: 'M4 7h16M4 12h16M4 17h10' },
  { id: 'cenas', label: 'Cenas', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'planes', label: 'Planes', icon: 'M12 22s-7-6-7-12a7 7 0 1114 0c0 6-7 12-7 12z' },
  { id: 'compra', label: 'Compra', icon: 'M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L21 8H6M9 20h.01M17 20h.01' },
  { id: 'saldos', label: 'Saldos', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'stats', label: 'Stats', icon: 'M4 20V4M4 20h16M8 20v-6M12 20V8M16 20v-9M20 20V6' },
]

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  const [tab, setTab] = useState('agenda')
  const sync = useSyncEngine()

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
        <div className="body"><div className="empty"><span className="e">🐋</span>Cargando…</div></div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="appbar">
        <WhaleLogo className="logo" />
        <div>
          <div className="ti">{event.name}</div>
          <div className="su">{event.lugar || 'Ballena Ops'} · v{APP_VERSION}</div>
        </div>
        <span title={`Sincronización: ${sync.status}`} style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, opacity: .8, whiteSpace: 'nowrap' }}>{SYNC_LABEL[sync.status] ?? ''}</span>
        <button className="switch" title="Compartir" aria-label="Compartir" onClick={() => { tap(); share({ title: event.name, text: `Estamos organizando "${event.name}" con Ballena Ops 🐋`, url: APP_URL, dialogTitle: 'Compartir evento' }) }} style={{ padding: '6px 10px' }}>📤</button>
        <button className="switch" title="Ajustes del evento" aria-label="Ajustes" onClick={() => { tap(); setTab('evento') }} style={{ padding: '6px 10px' }}>⚙️</button>
        <button className="switch" onClick={() => pick(null)}>Cambiar</button>
      </header>

      {tab === 'agenda' && <AgendaScreen eventId={activeId} event={event} onGoTab={setTab} />}
      {tab === 'gastos' && <ExpensesScreen eventId={activeId} event={event} />}
      {tab === 'cenas' && <CenasScreen eventId={activeId} event={event} />}
      {tab === 'planes' && <PlanesScreen eventId={activeId} event={event} />}
      {tab === 'compra' && <CompraScreen eventId={activeId} event={event} />}
      {tab === 'saldos' && <BalancesScreen eventId={activeId} event={event} />}
      {tab === 'stats' && <StatsScreen eventId={activeId} event={event} />}
      {tab === 'evento' && <EventSettingsScreen eventId={activeId} event={event} />}

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
