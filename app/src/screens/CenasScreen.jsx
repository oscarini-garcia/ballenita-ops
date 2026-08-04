import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, removeDinner,
  bungasOf, listDishes, addDish, DISH_CATEGORIES,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { porDia } from '../lib/evento.js'
import { tap } from '../lib/native.js'
import Fab from '../components/Fab.jsx'
import Recado from '../components/Recado.jsx'

const catLabel = (id) => DISH_CATEGORIES.find((c) => c.id === id)?.label ?? id
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Sin día')

export default function CenasScreen({ eventId, event }) {
  const dinners = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const dishes = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])
  const [open, setOpen] = useState(false)

  const bungaName = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : '—' }
  const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]))
  // Por día, y lo que cae fuera de las fechas al final y marcado. Sin esto una
  // cena del 14 en un viaje que empieza el 15 abría la lista como si tal cosa.
  const { dentro, fuera } = porDia(dinners, event)

  return (
    <div className="body">
      {dinners.length === 0 && (
        <div className="empty">
          <span className="e">🍳</span>Ninguna cena todavía.<br />
          Monta la primera con «+ Cena».<br />
          De momento se cena lo que haya en el maletero.
        </div>
      )}

      {dentro.map((c) => (
        <FichaDeCena key={c.id} cena={c} bungaName={bungaName} dishById={dishById} />
      ))}

      {fuera.length > 0 && (
        <>
          <div className="sec-h">Fuera de las fechas del viaje</div>
          <div className="note">
            {fuera.length === 1 ? 'Esta cena cae' : 'Estas cenas caen'} en un día que el evento ya no
            tiene. No {fuera.length === 1 ? 'sale' : 'salen'} en Agenda, pero {fuera.length === 1 ? 'sigue' : 'siguen'}
            {' '}contando en Estadísticas. Bórra{fuera.length === 1 ? 'la' : 'las'} o corrige las fechas
            en <b>Ajustes → Evento</b>.
          </div>
          {fuera.map((c) => (
            <FichaDeCena key={c.id} cena={c} bungaName={bungaName} dishById={dishById} fuera />
          ))}
        </>
      )}

      {/* El recado del viaje, al final del scroll (SPECS §14.22). */}
      <Recado evento={event} />

      <Fab label="Cena" onClick={() => setOpen(true)} />
      {open && <AddDinnerModal eventId={eventId} evento={event} bungas={bungas} dishes={dishes} onClose={() => setOpen(false)} />}
    </div>
  )
}

function FichaDeCena({ cena: c, bungaName, dishById, fuera = false }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div className="dia-cena">{fmtDay(c.dia)}</div>
        {fuera && <span className="pill owe">fuera del viaje</span>}
        <button className="btn sm ghost" onClick={() => removeDinner(c.id)}>borrar</button>
      </div>

      <div className="grid2" style={{ marginTop: 8 }}>
        <div className="card tight" style={{ padding: 8 }}>
          <div className="sec-h" style={{ margin: 0 }}>Mayores</div>
          <div className="anfitrion">{bungaName(c.bungaMayoresId)}</div>
        </div>
        <div className="card tight" style={{ padding: 8 }}>
          <div className="sec-h" style={{ margin: 0 }}>Niños</div>
          <div className="anfitrion">{bungaName(c.bungaNinosId)}</div>
        </div>
      </div>

      {c.platoIds?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {c.platoIds.map((id) => dishById[id]).filter(Boolean).map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' }}>
              <span className="pill neutral" style={{ minWidth: 92, textAlign: 'center' }}>{catLabel(d.categorias?.[0])}</span>
              <span className="plato-n">{d.name}{d.esFavorito ? ' ⭐' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* La mesa de niños puede comer otra cosa (§14.20 · G2). Mientras herede
          no se dice nada: la noche normal es que coman lo mismo, y un renglón
          repitiéndolo en todas las cenas es ruido. */}
      {c.platoIdsNinos && (
        <div className="note" style={{ marginTop: 8 }}>
          <b>Los niños comen otra cosa:</b>{' '}
          {c.platoIdsNinos.map((id) => dishById[id]?.name).filter(Boolean).join(' · ') || 'nada apuntado'}
        </div>
      )}
    </div>
  )
}

/**
 * `evento` entero y no solo su `id`: `addDish` necesita saber si es el Demo para
 * colgarle el plato (§14.9-quater). Antes esto llamaba a `addDish({…}, event)`
 * con un `event` que **no existe en este ámbito**: en el navegador resolvía al
 * `window.event` global —el objeto del clic—, así que el plato se guardaba sin
 * `eventId`, es decir en el catálogo compartido, también desde el Demo.
 */
function AddDinnerModal({ eventId, evento, bungas, dishes, onClose }) {
  useBloqueoDeScroll()
  const [dia, setDia] = useState('')
  const [bungaMayoresId, setMayores] = useState(bungas[0]?.id ?? '')
  const [bungaNinosId, setNinos] = useState(bungas[1]?.id ?? bungas[0]?.id ?? '')
  const [platoIds, setPlatoIds] = useState(() => new Set())
  // `null` = los niños comen lo mismo. Es la noche normal, así que es lo de
  // fábrica: separar las dos listas cuesta un toque, y no separarlas, ninguno.
  const [platosNinos, setPlatosNinos] = useState(null)

  // Alta rápida de plato
  const [newName, setNewName] = useState('')
  const [newCats, setNewCats] = useState(() => new Set())

  function toggle(id) {
    const s = new Set(platoIds); s.has(id) ? s.delete(id) : s.add(id); setPlatoIds(s)
  }
  function toggleNinos(id) {
    const s = new Set(platosNinos ?? platoIds); s.has(id) ? s.delete(id) : s.add(id); setPlatosNinos(s)
  }
  function toggleCat(id) {
    const s = new Set(newCats); s.has(id) ? s.delete(id) : s.add(id); setNewCats(s)
  }
  async function createDish() {
    if (!newName.trim() || newCats.size === 0) return
    const id = await addDish({ name: newName.trim(), categorias: [...newCats] }, evento)
    setPlatoIds(new Set([...platoIds, id]))
    setNewName(''); setNewCats(new Set())
  }
  async function submit() {
    if (!dia) return
    await addDinner(eventId, {
      dia, bungaMayoresId, bungaNinosId,
      platoIds: [...platoIds],
      platoIdsNinos: platosNinos ? [...platosNinos] : null,
    })
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

        <label>Platos <span className="apunte">(varios por tipo)</span></label>
        <div className="chips">
          {dishes.map((d) => (
            <button key={d.id} className={`chip${platoIds.has(d.id) ? ' on' : ''}`} onClick={() => toggle(d.id)}>
              {d.name}{d.esFavorito ? ' ⭐' : ''}
            </button>
          ))}
          {dishes.length === 0 && <span className="apunte">Catálogo vacío — crea uno abajo.</span>}
        </div>

        {/* Los niños heredan hasta que se toque (§14.20 · G2). Se sigue
            escribiendo **una** lista: separarlas es para la noche en que ellos
            cenan macarrones y los mayores paella, no para todas. */}
        <div className="card tight" style={{ marginTop: 10 }}>
          <div className="row">
            <div className="main">
              <div className="n">Los niños comen lo mismo</div>
              <div className="sub">
                {platosNinos ? 'Tienen su propia lista.' : 'Heredan los platos de arriba.'}
              </div>
            </div>
            <button
              className="btn sm ghost"
              aria-pressed={Boolean(platosNinos)}
              onClick={() => { tap(); setPlatosNinos(platosNinos ? null : new Set(platoIds)) }}
            >
              {platosNinos ? 'Que coman lo mismo' : 'Cambiar la suya'}
            </button>
          </div>
          {platosNinos && (
            <div className="chips" style={{ marginTop: 8 }}>
              {dishes.map((d) => (
                <button key={d.id} className={`chip${platosNinos.has(d.id) ? ' on' : ''}`} onClick={() => toggleNinos(d.id)}>
                  {d.name}
                </button>
              ))}
            </div>
          )}
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

        <div style={{ marginTop: 16 }}><button className="btn block" onClick={submit}>Guardar cena</button></div>
      </div>
    </div>
  )
}
