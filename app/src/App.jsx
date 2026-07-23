import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEvent, personsOf } from './db.js'
import WhaleLogo from './components/WhaleLogo.jsx'
import UserBadge from './components/UserBadge.jsx'
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
import { tap } from './lib/native.js'

const ACTIVE_KEY = 'ballena.activeEventId'

// Punto de estado de la cabecera: color + ayuda + si conviene animar el "recheck".
// 🟢 al día · 🟡 conectado con cambios encolados · 🔴 sin red · ⚪ solo local.
function syncDot(sync) {
  if (!sync.isConfigured) return { color: '#8fb0a0', title: 'Solo local (sin sincronización)', checking: false }
  if (!sync.online || sync.status === 'offline') return { color: '#e5544b', title: 'Sin conexión', checking: false }
  if (sync.status === 'syncing' || sync.status === 'busy') return { color: '#e7a33e', title: 'Sincronizando…', checking: true }
  if (sync.status === 'error') return { color: '#e7a33e', title: 'Error al sincronizar · toca para reintentar', checking: false }
  if (sync.dirty) return { color: '#e7a33e', title: 'Cambios sin sincronizar · toca para sincronizar', checking: false }
  return { color: '#2e9e6b', title: 'Conectado y al día', checking: false }
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
        <div className="grow">
          <div className="ti">{event.name}</div>
          <div className="su">{event.lugar || 'Ballena Ops'}</div>
        </div>
        {(() => {
          const d = syncDot(sync)
          return (
            <button
              className={`sync-dot${d.checking ? ' checking' : ''}`}
              title={d.title}
              aria-label={d.title}
              onClick={() => { tap(); sync.recheck() }}
            >
              <span className="d" style={{ background: d.color }} />
            </button>
          )
        })()}
        <UserBadge eventId={activeId} persons={persons} />
        <button className="iconbtn" title="Ajustes del evento" aria-label="Ajustes" onClick={() => { tap(); setTab('evento') }}>⚙️</button>
      </header>

      {tab === 'agenda' && <AgendaScreen eventId={activeId} event={event} onGoTab={setTab} />}
      {tab === 'gastos' && <ExpensesScreen eventId={activeId} event={event} />}
      {tab === 'cenas' && <CenasScreen eventId={activeId} event={event} />}
      {tab === 'planes' && <PlanesScreen eventId={activeId} event={event} />}
      {tab === 'compra' && <CompraScreen eventId={activeId} event={event} />}
      {tab === 'saldos' && <BalancesScreen eventId={activeId} event={event} />}
      {tab === 'stats' && <StatsScreen eventId={activeId} event={event} />}
      {tab === 'evento' && <EventSettingsScreen eventId={activeId} event={event} onChangeEvent={() => pick(null)} />}

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
