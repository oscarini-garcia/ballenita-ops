import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import EventsScreen from './screens/EventsScreen.jsx'
import ExpensesScreen from './screens/ExpensesScreen.jsx'
import BalancesScreen from './screens/BalancesScreen.jsx'
import EventSettingsScreen from './screens/EventSettingsScreen.jsx'

const ACTIVE_KEY = 'ballena.activeEventId'

const TABS = [
  { id: 'gastos', label: 'Gastos', icon: 'M4 7h16M4 12h16M4 17h10' },
  { id: 'saldos', label: 'Saldos', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'evento', label: 'Ajustes', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a7.9 7.9 0 000-2l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1l-.3-2.5H9.9l-.3 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.4L3.6 11a7.9 7.9 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.5h4.2l.3-2.5a7 7 0 001.7-1l2.4 1 2-3.4z' },
]

export default function App() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  const [tab, setTab] = useState('gastos')

  const event = useLiveQuery(() => (activeId ? getEvent(activeId) : null), [activeId])

  // Si el evento activo desaparece (borrado), volver a la lista.
  useEffect(() => {
    if (activeId && event === undefined) return // cargando
    if (activeId && event === null) pick(null)
  }, [event, activeId])

  function pick(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
    setActiveId(id)
    setTab('gastos')
  }

  if (!activeId || !event) {
    return (
      <div className="app">
        <EventsScreen onPick={pick} />
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
        <button className="switch" onClick={() => pick(null)}>Cambiar</button>
      </header>

      {tab === 'gastos' && <ExpensesScreen eventId={activeId} event={event} />}
      {tab === 'saldos' && <BalancesScreen eventId={activeId} event={event} />}
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
