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
import AgendaScreen from './screens/AgendaScreen.jsx'
import StatsScreen from './screens/StatsScreen.jsx'

const ACTIVE_KEY = 'ballena.activeEventId'

const TABS = [
  { id: 'agenda', label: 'Agenda', icon: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4' },
  { id: 'gastos', label: 'Gastos', icon: 'M4 7h16M4 12h16M4 17h10' },
  { id: 'cenas', label: 'Cenas', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'planes', label: 'Planes', icon: 'M12 22s-7-6-7-12a7 7 0 1114 0c0 6-7 12-7 12z' },
  { id: 'saldos', label: 'Saldos', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'stats', label: 'Stats', icon: 'M4 20V4M4 20h16M8 20v-6M12 20V8M16 20v-9M20 20V6' },
]

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  const [tab, setTab] = useState('agenda')

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
          <div className="su">{event.lugar || 'Ballena Ops'}</div>
        </div>
        <button className="switch" title="Ajustes del evento" aria-label="Ajustes" onClick={() => setTab('evento')} style={{ marginLeft: 'auto', padding: '6px 10px' }}>⚙️</button>
        <button className="switch" onClick={() => pick(null)}>Cambiar</button>
      </header>

      {tab === 'agenda' && <AgendaScreen eventId={activeId} event={event} onGoTab={setTab} />}
      {tab === 'gastos' && <ExpensesScreen eventId={activeId} event={event} />}
      {tab === 'cenas' && <CenasScreen eventId={activeId} event={event} />}
      {tab === 'planes' && <PlanesScreen eventId={activeId} event={event} />}
      {tab === 'saldos' && <BalancesScreen eventId={activeId} event={event} />}
      {tab === 'stats' && <StatsScreen eventId={activeId} event={event} />}
      {tab === 'evento' && <EventSettingsScreen eventId={activeId} event={event} />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
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
