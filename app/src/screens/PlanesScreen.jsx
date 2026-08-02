import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { plansOf, addPlan, updatePlan, removePlan, personsOf, listPlanIdeas, guardarPlanComoIdea } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import { porDia } from '../lib/evento.js'
import { useIdentidad } from '../lib/identidad.js'
import Fab from '../components/Fab.jsx'

const VOTES = ['👍', '🤷', '👎']
const fmtDay = (d) => new Date(d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

export default function PlanesScreen({ eventId, event }) {
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const [open, setOpen] = useState(false)

  // Quién eres para votar sale de `lib/identidad.js`, que es la misma que usan
  // la cabecera y Ajustes → Quién eres. Antes esta pantalla guardaba lo suyo en
  // `ballena.person.<evento>` y la de Ajustes en `ballena.me:<evento>`: dos
  // llaves distintas, así que identificarse en Ajustes no servía para votar y
  // aquí te lo volvía a preguntar con un desplegable propio.
  const { meId: me } = useIdentidad(eventId, persons)

  const tally = (votos = {}) => VOTES.map((v) => Object.values(votos).filter((x) => x === v).length)

  function vote(plan, emoji) {
    if (!me) return
    const votos = { ...(plan.votos ?? {}) }
    if (votos[me] === emoji) delete votos[me]
    else votos[me] = emoji
    updatePlan(plan.id, { votos })
  }
  // Mismo criterio que las cenas (`lib/evento.js`): por día, y lo que cayó fuera
  // de las fechas al final y marcado. Un plan del 14 en un viaje que empieza el
  // 15 no es el primer plan del viaje, y arriba del todo lo parecía.
  const { dentro, fuera } = porDia(plans, event)

  const ficha = (plan, esFuera = false) => {
    const [yes, meh, no] = tally(plan.votos)
    const mine = plan.votos?.[me]
    return (
      <div className="card" key={plan.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div className="plan-n">{plan.titulo}</div>
            <div className="cifra-l">
              {plan.dia ? fmtDay(plan.dia) : 'Sin día'}
              {plan.costeEstimado ? ` · ~${(plan.costeEstimado / 100).toFixed(0)} €` : ''}
              {plan.enlace ? <> · <a href={plan.enlace} target="_blank" rel="noreferrer">enlace</a></> : ''}
            </div>
          </div>
          <span className={`pill ${esFuera ? 'owe' : plan.estado === 'confirmado' ? 'owed' : 'neutral'}`}>
            {esFuera ? 'fuera del viaje' : plan.estado}
          </span>
        </div>

        <div className="chips" style={{ marginTop: 10 }}>
          {VOTES.map((v, i) => (
            <button key={v} className={`chip${mine === v ? ' on' : ''}`} onClick={() => vote(plan, v)} disabled={!me}>
              {v} {[yes, meh, no][i]}
            </button>
          ))}
        </div>

        <div className="chips" style={{ marginTop: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
          <input type="date" value={plan.dia || ''} onChange={(e) => updatePlan(plan.id, { dia: e.target.value || null })} className="fecha-chip" />
          {plan.dia && <button className="btn sm ghost" onClick={() => updatePlan(plan.id, { dia: null })}>quitar día</button>}
          {plan.estado === 'confirmado'
            ? <button className="btn sm ghost" onClick={() => updatePlan(plan.id, { estado: 'votando' })}>a votación</button>
            : <button className="btn sm" onClick={() => updatePlan(plan.id, { estado: 'confirmado' })}>confirmar</button>}
          {plan.ideaId
            ? <span className="pill neutral">en ideas</span>
            : <button className="btn sm ghost" onClick={() => { tap(); guardarPlanComoIdea(plan, event) }}>guardar idea</button>}
          <button className="btn sm danger" onClick={() => removePlan(plan.id)}>borrar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="body">
      {!me && persons.length > 0 && (
        <div className="note">
          Para votar hace falta saber quién eres: dilo en <b>Ajustes → Quién eres</b>.
        </div>
      )}

      {plans.length === 0 && (
        <div className="empty"><span className="e">🗺️</span>Ningún plan todavía.<br />Propón una idea con «+ Plan».</div>
      )}

      {dentro.map((plan) => ficha(plan))}

      {fuera.length > 0 && (
        <>
          <div className="sec-h">Fuera de las fechas del viaje</div>
          <div className="note">
            {fuera.length === 1 ? 'Este plan cae' : 'Estos planes caen'} en un día que el evento ya no
            tiene, así que no {fuera.length === 1 ? 'sale' : 'salen'} en Agenda. Cámbia{fuera.length === 1 ? 'le' : 'les'} el
            día aquí mismo, quíta{fuera.length === 1 ? 'selo' : 'selo'} o corrige las fechas en <b>Ajustes → Evento</b>.
          </div>
          {fuera.map((plan) => ficha(plan, true))}
        </>
      )}

      <Fab label="Plan" onClick={() => setOpen(true)} />
      {open && <AddPlanModal eventId={eventId} event={event} onClose={() => setOpen(false)} />}
    </div>
  )
}

function AddPlanModal({ eventId, event, onClose }) {
  useBloqueoDeScroll()
  const ideas = useLiveQuery(() => listPlanIdeas(event), [event?.id, event?.esDemo], [])
  const [ubicacion, setUbicacion] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [dia, setDia] = useState('')
  const [enlace, setEnlace] = useState('')
  const [coste, setCoste] = useState('')
  // De qué idea del catálogo se rellenó, para poder contar en cuántos viajes se
  // ha usado. Lo que se guarda son los campos de abajo: son copias (C1).
  const [ideaId, setIdeaId] = useState(null)

  // El atajo de B3: el catálogo también aparece **aquí**, cuando ya has decidido
  // crear algo. El área «Ideas» responde a «¿qué hacíamos los otros años?»; esto
  // responde a «esto ya lo tengo apuntado, no me lo hagas escribir otra vez».
  function rellenarCon(idea) {
    tap()
    setIdeaId(idea.id)
    setTitulo(idea.titulo ?? '')
    setDescripcion(idea.descripcion ?? '')
    setUbicacion(idea.ubicacion ?? '')
    setEnlace(idea.enlace ?? '')
    setCoste(idea.costeEstimado ? String(idea.costeEstimado / 100) : '')
  }

  async function submit() {
    if (!titulo.trim()) return
    await addPlan(eventId, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      dia: dia || null,
      ubicacion: ubicacion.trim(),
      enlace: enlace.trim(),
      costeEstimado: coste ? Math.round(Number(coste) * 100) : null,
      ideaId,
    })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>×</button>
        <h2>Nuevo plan</h2>
        {ideas.length > 0 && (
          <>
            <label>¿De las de siempre? <span className="apunte">(rellena el resto)</span></label>
            <div className="chips">
              {ideas.map((i) => (
                <button
                  key={i.id}
                  className={`chip${ideaId === i.id ? ' on' : ''}`}
                  aria-pressed={ideaId === i.id}
                  onClick={() => rellenarCon(i)}
                >{i.titulo}</button>
              ))}
            </div>
          </>
        )}
        <label>Título</label>
        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Excursión a las cuevas" autoFocus />
        <label>Descripción (opcional)</label>
        <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="grid2">
          <div><label>Día (opcional)</label><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></div>
          <div><label>Coste/persona (opcional)</label><input type="number" inputMode="decimal" value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="0" /></div>
        </div>
        <label>Dónde (opcional)</label>
        <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Cala del sur" />
        <label>Enlace (opcional)</label>
        <input type="text" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />
        <div style={{ marginTop: 16 }}><button className="btn block" onClick={submit}>Proponer plan</button></div>
        <div className="note" style={{ marginTop: 10 }}>La votación solo orienta; cualquiera confirma cuando hay consenso (§4).</div>
      </div>
    </div>
  )
}
