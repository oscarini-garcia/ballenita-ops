import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listEvents, createEvent, seedExample } from '../db.js'
import WhaleLogo from '../components/WhaleLogo.jsx'

export default function EventsScreen({ onPick }) {
  const events = useLiveQuery(listEvents, [], [])
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="appbar">
        <WhaleLogo className="logo" />
        <div>
          <div className="ti">Ballena Ops</div>
          <div className="su">Tus eventos 🐋</div>
        </div>
      </header>

      <div className="body">
        {events.length === 0 && (
          <div className="empty">
            <span className="e">🐋</span>
            Aún no hay ningún evento.<br />Crea uno o carga el de ejemplo.
          </div>
        )}

        {events.map((e) => (
          <button key={e.id} className="card row" style={{ textAlign: 'left', width: '100%', border: '1px solid var(--line-soft)' }} onClick={() => onPick(e.id)}>
            <div className="av" style={{ background: 'var(--spout-deep)' }}>🗓️</div>
            <div className="main">
              <div className="n">{e.name}</div>
              <div className="sub">{[e.lugar, fmtRange(e)].filter(Boolean).join(' · ')}</div>
            </div>
            <span className="pill neutral">{e.status}</span>
          </button>
        ))}

        <button className="btn block" onClick={() => setOpen(true)}>+ Nuevo evento</button>
        {events.length === 0 && (
          <button className="btn ghost block" onClick={async () => onPick(await seedExample())}>
            Cargar ejemplo «Ballenita 2026»
          </button>
        )}
      </div>

      {open && <NewEventModal onClose={() => setOpen(false)} onCreate={onPick} />}
    </>
  )
}

function fmtRange(e) {
  if (!e.startDate) return ''
  const f = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return e.endDate ? `${f(e.startDate)} – ${f(e.endDate)}` : f(e.startDate)
}

function NewEventModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [lugar, setLugar] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [startDate, setStart] = useState('')
  const [endDate, setEnd] = useState('')

  async function submit() {
    if (!name.trim()) return
    const id = await createEvent({ name: name.trim(), lugar: lugar.trim(), currency, startDate, endDate })
    onCreate(id)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>Nuevo evento</h2>
        <label>Nombre</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ballenita 2026" autoFocus />
        <label>Lugar (opcional)</label>
        <input type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Camping La Ballena Alegre" />
        <div className="grid2">
          <div><label>Inicio</label><input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label>Fin</label><input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <label>Moneda base</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="EUR">€ Euro</option>
          <option value="GBP">£ Libra</option>
          <option value="USD">$ Dólar</option>
        </select>
        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={submit}>Crear evento</button>
        </div>
      </div>
    </div>
  )
}
