import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { plansOf, addPlan, updatePlan, removePlan, personsOf } from '../db.js'

const VOTES = ['👍', '🤷', '👎']
const fmtDay = (d) => new Date(d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

export default function PlanesScreen({ eventId }) {
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const [open, setOpen] = useState(false)

  // Identidad ligera para votar (§14: en Fase 0 aún no hay login por email).
  const key = `ballena.person.${eventId}`
  const [me, setMe] = useState(() => localStorage.getItem(key) || '')
  function pickMe(id) { localStorage.setItem(key, id); setMe(id) }

  const tally = (votos = {}) => VOTES.map((v) => Object.values(votos).filter((x) => x === v).length)

  function vote(plan, emoji) {
    if (!me) return
    const votos = { ...(plan.votos ?? {}) }
    if (votos[me] === emoji) delete votos[me]
    else votos[me] = emoji
    updatePlan(plan.id, { votos })
  }
  const sorted = [...plans].sort((a, b) => (a.dia || '9999').localeCompare(b.dia || '9999'))

  return (
    <div className="body">
      <div className="card tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>Eres:</span>
        <select value={me} onChange={(e) => pickMe(e.target.value)} style={{ padding: '7px 10px' }}>
          <option value="">— elígete para votar —</option>
          {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {plans.length === 0 && (
        <div className="empty"><span className="e">🗺️</span>Ningún plan todavía.<br />Propón una idea con el botón +.</div>
      )}

      {sorted.map((plan) => {
        const [yes, meh, no] = tally(plan.votos)
        const mine = plan.votos?.[me]
        return (
          <div className="card" key={plan.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 750, fontSize: 15 }}>{plan.titulo}</div>
                <div className="sub" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  {plan.dia ? fmtDay(plan.dia) : 'Sin día'}
                  {plan.costeEstimado ? ` · ~${(plan.costeEstimado / 100).toFixed(0)} €` : ''}
                  {plan.enlace ? <> · <a href={plan.enlace} target="_blank" rel="noreferrer">enlace</a></> : ''}
                </div>
              </div>
              <span className={`pill ${plan.estado === 'confirmado' ? 'owed' : 'neutral'}`}>{plan.estado}</span>
            </div>

            <div className="chips" style={{ marginTop: 10 }}>
              {VOTES.map((v, i) => (
                <button key={v} className={`chip${mine === v ? ' on' : ''}`} onClick={() => vote(plan, v)} disabled={!me}>
                  {v} {[yes, meh, no][i]}
                </button>
              ))}
            </div>

            <div className="chips" style={{ marginTop: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
              <input type="date" value={plan.dia || ''} onChange={(e) => updatePlan(plan.id, { dia: e.target.value || null })} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
              {plan.dia && <button className="btn sm ghost" onClick={() => updatePlan(plan.id, { dia: null })}>quitar día</button>}
              {plan.estado === 'confirmado'
                ? <button className="btn sm ghost" onClick={() => updatePlan(plan.id, { estado: 'votando' })}>a votación</button>
                : <button className="btn sm" onClick={() => updatePlan(plan.id, { estado: 'confirmado' })}>confirmar</button>}
              <button className="btn sm danger" onClick={() => removePlan(plan.id)}>borrar</button>
            </div>
          </div>
        )
      })}

      <button className="fab" aria-label="Proponer plan" onClick={() => setOpen(true)}>+</button>
      {open && <AddPlanModal eventId={eventId} onClose={() => setOpen(false)} />}
    </div>
  )
}

function AddPlanModal({ eventId, onClose }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [dia, setDia] = useState('')
  const [enlace, setEnlace] = useState('')
  const [coste, setCoste] = useState('')

  async function submit() {
    if (!titulo.trim()) return
    await addPlan(eventId, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      dia: dia || null,
      enlace: enlace.trim(),
      costeEstimado: coste ? Math.round(Number(coste) * 100) : null,
    })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>Nuevo plan</h2>
        <label>Título</label>
        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Excursión a las cuevas" autoFocus />
        <label>Descripción (opcional)</label>
        <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="grid2">
          <div><label>Día (opcional)</label><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></div>
          <div><label>Coste/persona (opcional)</label><input type="number" inputMode="decimal" value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="0" /></div>
        </div>
        <label>Enlace (opcional)</label>
        <input type="text" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />
        <div style={{ marginTop: 16 }}><button className="btn block" onClick={submit}>Proponer plan</button></div>
        <div className="note" style={{ marginTop: 10 }}>La votación solo orienta; cualquiera confirma cuando hay consenso (§4).</div>
      </div>
    </div>
  )
}
