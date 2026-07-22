import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, removeDinner,
  bungasOf, listDishes, addDish, DISH_CATEGORIES,
} from '../db.js'

const catLabel = (id) => DISH_CATEGORIES.find((c) => c.id === id)?.label ?? id
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Sin día')

export default function CenasScreen({ eventId }) {
  const dinners = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const dishes = useLiveQuery(listDishes, [], [])
  const [open, setOpen] = useState(false)

  const bungaName = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : '—' }
  const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]))

  return (
    <div className="body">
      {dinners.length === 0 && (
        <div className="empty"><span className="e">🍳</span>Ninguna cena todavía.<br />Monta la primera con el botón +.</div>
      )}

      {dinners.map((c) => (
        <div className="card" key={c.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 800, textTransform: 'capitalize' }}>{fmtDay(c.dia)}</div>
            <button className="btn sm ghost" onClick={() => removeDinner(c.id)}>borrar</button>
          </div>

          <div className="grid2" style={{ marginTop: 8 }}>
            <div className="card tight" style={{ padding: 8 }}>
              <div className="sec-h" style={{ margin: 0 }}>Mayores</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{bungaName(c.bungaMayoresId)}</div>
            </div>
            <div className="card tight" style={{ padding: 8 }}>
              <div className="sec-h" style={{ margin: 0 }}>Niños</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{bungaName(c.bungaNinosId)}</div>
            </div>
          </div>

          {c.platoIds?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {c.platoIds.map((id) => dishById[id]).filter(Boolean).map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' }}>
                  <span className="pill neutral" style={{ minWidth: 92, textAlign: 'center' }}>{catLabel(d.categorias?.[0])}</span>
                  <span style={{ fontSize: 13.5 }}>{d.name}{d.esFavorito ? ' ⭐' : ''}</span>
                </div>
              ))}
            </div>
          )}

          {c.cantidades && <div className="note" style={{ marginTop: 8 }}><b>Cantidades:</b> {c.cantidades}</div>}
          {c.queSeHace && <div className="note" style={{ marginTop: 8 }}><b>Qué se hace:</b> {c.queSeHace}</div>}
        </div>
      ))}

      <button className="fab" aria-label="Añadir cena" onClick={() => setOpen(true)}>+</button>
      {open && <AddDinnerModal eventId={eventId} bungas={bungas} dishes={dishes} onClose={() => setOpen(false)} />}
    </div>
  )
}

function AddDinnerModal({ eventId, bungas, dishes, onClose }) {
  const [dia, setDia] = useState('')
  const [bungaMayoresId, setMayores] = useState(bungas[0]?.id ?? '')
  const [bungaNinosId, setNinos] = useState(bungas[1]?.id ?? bungas[0]?.id ?? '')
  const [platoIds, setPlatoIds] = useState(() => new Set())
  const [queSeHace, setQueSeHace] = useState('')
  const [cantidades, setCantidades] = useState('')

  // Alta rápida de plato
  const [newName, setNewName] = useState('')
  const [newCats, setNewCats] = useState(() => new Set())

  function toggle(id) {
    const s = new Set(platoIds); s.has(id) ? s.delete(id) : s.add(id); setPlatoIds(s)
  }
  function toggleCat(id) {
    const s = new Set(newCats); s.has(id) ? s.delete(id) : s.add(id); setNewCats(s)
  }
  async function createDish() {
    if (!newName.trim() || newCats.size === 0) return
    const id = await addDish({ name: newName.trim(), categorias: [...newCats] })
    setPlatoIds(new Set([...platoIds, id]))
    setNewName(''); setNewCats(new Set())
  }
  async function submit() {
    if (!dia) return
    await addDinner(eventId, { dia, bungaMayoresId, bungaNinosId, platoIds: [...platoIds], queSeHace: queSeHace.trim(), cantidades: cantidades.trim() })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>Nueva cena</h2>

        <label>Día</label>
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} autoFocus />

        <div className="grid2">
          <div><label>Bunga mayores</label>
            <select value={bungaMayoresId} onChange={(e) => setMayores(e.target.value)}>
              <option value="">—</option>{bungas.map((b) => <option key={b.id} value={b.id}>{b.alias || b.name}</option>)}
            </select></div>
          <div><label>Bunga niños</label>
            <select value={bungaNinosId} onChange={(e) => setNinos(e.target.value)}>
              <option value="">—</option>{bungas.map((b) => <option key={b.id} value={b.id}>{b.alias || b.name}</option>)}
            </select></div>
        </div>

        <label>Platos <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>(varios por tipo)</span></label>
        <div className="chips">
          {dishes.map((d) => (
            <button key={d.id} className={`chip${platoIds.has(d.id) ? ' on' : ''}`} onClick={() => toggle(d.id)}>
              {d.name}{d.esFavorito ? ' ⭐' : ''}
            </button>
          ))}
          {dishes.length === 0 && <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Catálogo vacío — crea uno abajo.</span>}
        </div>

        <div className="card tight" style={{ marginTop: 10 }}>
          <label style={{ marginTop: 0 }}>Nuevo plato al vuelo</label>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tortilla de patata" />
          <div className="chips" style={{ marginTop: 8 }}>
            {DISH_CATEGORIES.map((c) => (
              <button key={c.id} className={`chip${newCats.has(c.id) ? ' on' : ''}`} onClick={() => toggleCat(c.id)}>{c.label}</button>
            ))}
          </div>
          <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={createDish}>+ añadir al catálogo</button>
        </div>

        <label>Qué se hace</label>
        <textarea rows={2} value={queSeHace} onChange={(e) => setQueSeHace(e.target.value)} placeholder="Quién cocina, preparación…" />
        <label>Cantidades</label>
        <textarea rows={2} value={cantidades} onChange={(e) => setCantidades(e.target.value)} placeholder="2 kg arroz · 30 mejillones…" />

        <div style={{ marginTop: 16 }}><button className="btn block" onClick={submit}>Guardar cena</button></div>
      </div>
    </div>
  )
}
