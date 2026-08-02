import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listPlanIdeas, addPlanIdea, updatePlanIdea, removePlanIdea,
  traerIdeaAlViaje, usoDeIdeas,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Fab from '../components/Fab.jsx'

/**
 * «Ideas»: lo que se repite de un viaje a otro.
 *
 * Un plan era dos cosas en la misma fila —la idea, que vuelve cada verano, y la
 * propuesta de este año, con su día, su estado y sus votos—, así que reutilizar
 * uno del viaje pasado habría arrastrado el 10 de agosto de entonces y los votos
 * de gente que este año no viene. Aquí vive solo lo primero.
 *
 * Es la misma figura que Platos ↔ Cenas y no un invento nuevo: un catálogo, y lo
 * que se hace con él. Decidido en `docs/diseño/planes-catalogo.html` (A3 · B3 · C1).
 *
 * **Se copia, no se enlaza** (C1): traer una idea deja un plan independiente. Si
 * el año que viene corriges el enlace en el catálogo, el viaje de este año se
 * queda como estaba, que es lo que uno espera de algo que ya ocurrió.
 */
export default function IdeasScreen({ eventId, event }) {
  const ideas = useLiveQuery(() => listPlanIdeas(event), [event?.id, event?.esDemo], [])
  const usos = useLiveQuery(usoDeIdeas, [], {})
  const [editando, setEditando] = useState(null) // la idea, o 'nueva'
  const [traida, setTraida] = useState(null)

  async function traer(idea) {
    tap()
    await traerIdeaAlViaje(eventId, idea)
    setTraida(idea.id)
  }

  return (
    <div className="body">
      <div className="note">
        Las ideas son <b>las mismas en todos los viajes</b>. Al traer una se copia a este evento
        <b> sin día, sin votos y a votación</b>: el día y los votos son de cada agosto.
      </div>

      {ideas.length === 0 && (
        <div className="empty">
          <span className="e">🗺️</span>Todavía no hay ideas guardadas.<br />
          Apunta la primera, o guarda un plan desde Planes.
        </div>
      )}

      {ideas.length > 0 && (
        <div className="card tight">
          {ideas.map((idea) => (
            <div className="row" key={idea.id}>
              <div className="main">
                <div className="n">{idea.titulo}</div>
                <div className="sub">
                  {[
                    idea.ubicacion,
                    idea.costeEstimado ? `~${Math.round(idea.costeEstimado / 100)} €` : null,
                    usos[idea.id] ? `${usos[idea.id]} ${usos[idea.id] === 1 ? 'viaje' : 'viajes'}` : null,
                  ].filter(Boolean).join(' · ') || 'sin más datos'}
                </div>
              </div>
              <button className="btn sm" disabled={traida === idea.id} onClick={() => traer(idea)}>
                {traida === idea.id ? '✓ traída' : 'traer'}
              </button>
              <button className="verbo-fila" aria-label={`Editar ${idea.titulo}`} onClick={() => { tap(); setEditando(idea) }}>
                <Icono nombre="lapiz" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Fab label="Idea" onClick={() => setEditando('nueva')} />
      {editando && (
        <ModalIdea
          idea={editando === 'nueva' ? null : editando}
          evento={event}
          usos={editando === 'nueva' ? 0 : (usos[editando.id] ?? 0)}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function ModalIdea({ idea, evento, usos, onClose }) {
  useBloqueoDeScroll()
  const [titulo, setTitulo] = useState(idea?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(idea?.descripcion ?? '')
  const [ubicacion, setUbicacion] = useState(idea?.ubicacion ?? '')
  const [enlace, setEnlace] = useState(idea?.enlace ?? '')
  const [coste, setCoste] = useState(idea?.costeEstimado ? String(idea.costeEstimado / 100) : '')
  const [confirmando, setConfirmando] = useState(false)

  async function guardar() {
    if (!titulo.trim()) return
    tap()
    const campos = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      ubicacion: ubicacion.trim(),
      enlace: enlace.trim(),
      costeEstimado: coste ? Math.round(parseFloat(coste.replace(',', '.')) * 100) : null,
    }
    if (idea) await updatePlanIdea(idea.id, campos)
    else await addPlanIdea(campos, evento)
    onClose()
  }

  async function borrar() {
    tap()
    await removePlanIdea(idea.id)
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{idea ? 'Editar idea' : 'Idea nueva'}</h2>

        <label htmlFor="idea-titulo">Qué es</label>
        <input id="idea-titulo" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Playa de la Cala" autoFocus />

        <label htmlFor="idea-donde">Dónde</label>
        <input id="idea-donde" type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Cala del sur" />

        <label htmlFor="idea-desc">Detalles</label>
        <textarea id="idea-desc" rows="2" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Llevar sombrilla, no hay chiringuito" />

        <label htmlFor="idea-enlace">Enlace</label>
        <input id="idea-enlace" type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />

        <label htmlFor="idea-coste">Coste orientativo por persona (€)</label>
        <input id="idea-coste" type="number" inputMode="decimal" value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="12" />
        {/* El precio de la entrada sube cada año: por eso es «orientativo» y por
            eso lo que se trae al viaje es una copia que puedes corregir sin
            tocar el catálogo. */}

        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={guardar} disabled={!titulo.trim()}>
            {idea ? 'Guardar' : 'Añadir al catálogo'}
          </button>
        </div>

        {idea && (
          <div style={{ marginTop: 10 }}>
            {confirmando ? (
              <>
                <div className="note">
                  Se borra <b>de todos los viajes</b>.{' '}
                  {usos > 0
                    ? `Los planes de ${usos === 1 ? 'el viaje' : `los ${usos} viajes`} donde ya la trajiste se quedan como están: son copias.`
                    : 'Todavía no la has traído a ningún viaje.'}
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="btn sm danger" onClick={borrar}>Sí, borrarla</button>
                  <button className="btn sm ghost" onClick={() => setConfirmando(false)}>Dejarlo</button>
                </div>
              </>
            ) : (
              <button className="btn sm ghost block" onClick={() => { tap(); setConfirmando(true) }}>Borrar idea</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
