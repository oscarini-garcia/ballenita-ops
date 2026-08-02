import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { plansOf, addPlan, updatePlan, personsOf, devolverPlanAIdea } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { useIdentidad } from '../lib/identidad.js'
import { esAdministrador } from '../lib/admin.js'
import { leerSesion } from '../auth/sesion.js'
import { porDia } from '../lib/evento.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Fab from '../components/Fab.jsx'

const VOTES = ['👍', '🤷', '👎']
const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Planes: **aquí solo se vota**.
 *
 * La pantalla hacía tres trabajos a la vez —votar, poner fecha y administrar— y
 * se le notaba. Medido en el navegador: cada plan era una tarjeta de **299,9 pt**
 * en un cuerpo de 633,6 —cabían 2,1— con **siete botones**, un selector de fecha
 * nativo que traía su propio dibujo y su propia alineación, y **ocho colores**
 * contando el verde de la pastilla, el rojo de «borrar», el azul del enlace y los
 * tres emoji de voto.
 *
 * Ahora cada plan es una fila de **70,7 pt** —caben ocho—, el día se pone en
 * **Agenda**, que es donde está el calendario, y lo de administrar vive dentro
 * del plan abierto. Decidido en `docs/diseño/planes-votar.html`.
 *
 * **Dos grupos y un orden que significa algo**: primero los elegidos —los que ya
 * tienen día—, después los disponibles por votos. El orden de creación no decía
 * nada.
 */
export default function PlanesScreen({ eventId, event }) {
  const plans = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { meId: me } = useIdentidad(eventId, persons)
  const [open, setOpen] = useState(false)
  const [abierto, setAbierto] = useState(null)

  const esAdmin = esAdministrador(leerSesion())

  // Lo que se cayó fuera de las fechas sigue apartado (§14.10-quater): un plan en
  // un día que el viaje ya no tiene no es un plan elegido.
  const { dentro, fuera } = porDia(plans, event)
  const elegidos = dentro.filter((p) => p.dia)
  const votosDe = (p) => Object.values(p.votos ?? {}).filter((v) => v === '👍').length
  const disponibles = dentro.filter((p) => !p.dia)
    .sort((a, b) => votosDe(b) - votosDe(a) || (a.titulo || '').localeCompare(b.titulo || '', 'es'))

  /**
   * La fila cerrada dice **quién falta por votar** (`planes-votar.html` · V5).
   * Es lo accionable —a esos hay que darles un toque— y cabe en el subtítulo que
   * ya existe, sin gastar un sitio nuevo.
   */
  function Fila({ plan, elegido }) {
    const sinVotar = persons.filter((p) => !(plan.votos ?? {})[p.id])
    // Los nombres solo cuando son uno o dos: ahí un nombre es accionable —«dale
    // un toque a Luis»—. Con cinco es una lista que no cabe y que además no dice
    // nada que el número no diga.
    const quienes = sinVotar.map((p) => p.apodo || p.name)
    const detalle = elegido
      ? fmtDay(plan.dia)
      : sinVotar.length === 0 ? 'han votado todos'
        : sinVotar.length === persons.length ? 'sin votos todavía'
          : quienes.length <= 2 ? `falta por votar ${quienes.join(' y ')}`
            : `faltan ${quienes.length} por votar`
    return (
      <button className="row fila-plan" onClick={() => { tap(); setAbierto(plan.id) }}>
        <div className={`ico${elegido ? ' verde' : ''}`}><Icono nombre="plan" /></div>
        <div className="main">
          <div className="n">{plan.titulo}</div>
          <div className="sub">{detalle}</div>
        </div>
        <span className={`pill ${elegido ? 'owed' : 'neutral'} tnum`}>{votosDe(plan)}</span>
      </button>
    )
  }

  const plan = plans.find((p) => p.id === abierto) ?? null

  return (
    <div className="body">
      {!me && persons.length > 0 && (
        <div className="note">
          Para votar hace falta saber quién eres: dilo en <b>Ajustes → Quién eres</b>.
        </div>
      )}

      {plans.length === 0 && (
        <div className="empty">
          <span className="e">🗺️</span>Ningún plan todavía.<br />
          Propón uno desde <b>Ideas</b>, o apúntalo con «+ Plan».
        </div>
      )}

      {elegidos.length > 0 && (
        <>
          <div className="sec-h"><span>Elegidos · {elegidos.length}</span></div>
          <div className="card tight">
            {elegidos.map((p) => <Fila key={p.id} plan={p} elegido />)}
          </div>
        </>
      )}

      {disponibles.length > 0 && (
        <>
          <div className="sec-h"><span>Disponibles · {disponibles.length}</span><span>por votos</span></div>
          <div className="card tight">
            {disponibles.map((p) => <Fila key={p.id} plan={p} />)}
          </div>
        </>
      )}

      {fuera.length > 0 && (
        <>
          <div className="sec-h">Fuera de las fechas del viaje</div>
          <div className="note">
            {fuera.length === 1 ? 'Este plan cae' : 'Estos planes caen'} en un día que el evento ya no
            tiene, así que no {fuera.length === 1 ? 'sale' : 'salen'} en Agenda. Corrige el día desde
            Agenda, o las fechas en <b>Ajustes → Evento</b>.
          </div>
          <div className="card tight">
            {fuera.map((p) => <Fila key={p.id} plan={p} />)}
          </div>
        </>
      )}

      <Fab label="Plan" onClick={() => setOpen(true)} />
      {open && <AddPlanModal eventId={eventId} onClose={() => setOpen(false)} />}
      {plan && (
        <PlanAbierto
          plan={plan}
          persons={persons}
          me={me}
          evento={event}
          esAdmin={esAdmin}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

/**
 * El plan abierto: se vota, se ve quién ha votado qué, y quien administra puede
 * devolverlo al catálogo.
 *
 * Los votos se enseñan con **los avatares agrupados bajo su voto**
 * (`planes-votar.html` · V3): cabe en una línea por voto y contesta las dos
 * preguntas a la vez —quién opina qué y quién falta—. Los que no han votado van
 * aparte y apagados, que es lo accionable.
 */
function PlanAbierto({ plan, persons, me, evento, esAdmin, onClose }) {
  useBloqueoDeScroll()
  const [confirmando, setConfirmando] = useState(false)

  const votos = plan.votos ?? {}
  const mio = votos[me]
  const conVoto = (v) => persons.filter((p) => votos[p.id] === v)
  const sinVotar = persons.filter((p) => !votos[p.id])
  const avatar = (p) => p.avatar || '🙂'

  function votar(emoji) {
    if (!me) return
    tap()
    const nuevos = { ...votos }
    if (nuevos[me] === emoji) delete nuevos[me]
    else nuevos[me] = emoji
    updatePlan(plan.id, { votos: nuevos })
  }

  async function devolver() {
    tap()
    await devolverPlanAIdea(plan, evento)
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fino" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{plan.titulo}</h2>
        {plan.dia && <div className="pista">{fmtDay(plan.dia)}</div>}
        {plan.descripcion && <p className="note">{plan.descripcion}</p>}
        {plan.enlace && (
          <p className="pista"><a href={plan.enlace} target="_blank" rel="noreferrer">{plan.enlace}</a></p>
        )}

        <label>Tu voto</label>
        <div className="chips">
          {VOTES.map((v) => (
            <button
              key={v}
              className={`chip${mio === v ? ' on' : ''}`}
              aria-pressed={mio === v}
              aria-label={`Votar ${v}`}
              onClick={() => votar(v)}
              disabled={!me}
            >{v}</button>
          ))}
        </div>

        <label>Quién ha votado</label>
        <div className="votantes">
          {VOTES.map((v) => (
            <div className="votantes-fila" key={v}>
              <span className="votantes-voto" aria-hidden>{v}</span>
              <span className="votantes-caras">
                {conVoto(v).length === 0
                  ? <span className="pista">nadie</span>
                  : conVoto(v).map((p) => (
                    <span key={p.id} className="cara" title={p.apodo || p.name}>{avatar(p)}</span>
                  ))}
              </span>
            </div>
          ))}
          {sinVotar.length > 0 && (
            <div className="votantes-fila">
              <span className="votantes-voto pista">falta</span>
              <span className="votantes-caras apagadas">
                {sinVotar.map((p) => (
                  <span key={p.id} className="cara" title={p.apodo || p.name}>{avatar(p)}</span>
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="note" style={{ marginTop: 12 }}>
          El día se pone en <b>Agenda</b>, tocando el día del viaje. Aquí solo se vota.
        </div>

        {esAdmin && (
          <div style={{ marginTop: 10 }}>
            {confirmando ? (
              <>
                <div className="note">
                  Sale de este viaje y <b>vuelve al catálogo de ideas</b>, con sus votos borrados.
                  Podrás volver a proponerlo cuando quieras.
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="btn sm danger" onClick={devolver}>Sí, devolverlo</button>
                  <button className="btn sm ghost" onClick={() => setConfirmando(false)}>Dejarlo</button>
                </div>
              </>
            ) : (
              <button className="btn sm ghost block" onClick={() => { tap(); setConfirmando(true) }}>
                Devolver a ideas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AddPlanModal({ eventId, onClose }) {
  useBloqueoDeScroll()
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enlace, setEnlace] = useState('')

  async function submit() {
    if (!titulo.trim()) return
    tap()
    // Nace a votación y **sin día**: el día se pone en Agenda.
    await addPlan(eventId, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      enlace: enlace.trim(),
    })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fino" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>Nuevo plan</h2>
        <label htmlFor="plan-titulo">Qué es</label>
        <input id="plan-titulo" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Excursión a las cuevas" autoFocus />
        <label htmlFor="plan-desc">Descripción</label>
        <textarea id="plan-desc" rows="4" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <label htmlFor="plan-enlace">Enlace</label>
        <input id="plan-enlace" type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />
        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={submit} disabled={!titulo.trim()}>Proponer plan</button>
        </div>
        <div className="note" style={{ marginTop: 10 }}>
          Nace a votación y sin día. El día se pone en <b>Agenda</b> cuando esté decidido.
        </div>
      </div>
    </div>
  )
}
