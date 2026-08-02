import { useState } from 'react'
import { finPara } from '../lib/fechas.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { listEvents, createEvent, seedExample, NOMBRE_DEMO } from '../db.js'
import WhaleLogo from '../components/WhaleLogo.jsx'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'

export default function EventsScreen({ onPick }) {
  const events = useLiveQuery(listEvents, [], [])
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="appbar">
        <WhaleLogo className="logo" />
        <div>
          <div className="ti">Ballena Ops</div>
          <div className="su">Tus eventos 🐳</div>
        </div>
      </header>

      <div className="body">
        {events.length === 0 && (
          <div className="empty">
            <span className="e">🐳</span>
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
            Cargar el evento «{NOMBRE_DEMO}»
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
  useBloqueoDeScroll()
  const [name, setName] = useState('')
  const [lugar, setLugar] = useState('')
  const [startDate, setStart] = useState('')
  const [endDate, setEnd] = useState('')

  async function submit() {
    if (!name.trim()) return
    // La moneda es siempre el euro y ya no se pregunta: el grupo es de aquí y
    // el desplegable solo servía para poder equivocarse.
    const id = await createEvent({ name: name.trim(), lugar: lugar.trim(), startDate, endDate })
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
        <label htmlFor="nuevo-desde">Inicio</label>
        <input
          id="nuevo-desde" type="date" value={startDate}
          onChange={(e) => { setStart(e.target.value); setEnd(finPara(e.target.value, endDate)) }}
        />
        <label htmlFor="nuevo-hasta">Fin</label>
        <input
          id="nuevo-hasta" type="date" value={endDate} min={startDate || undefined}
          onChange={(e) => setEnd(e.target.value)}
        />
        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={submit}>Crear evento</button>
        </div>
      </div>
    </div>
  )
}
