import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listPlanIdeas, addPlanIdea, updatePlanIdea, removePlanIdea,
  traerIdeaAlViaje, usoDeIdeas, ideasYaPropuestas, personsOf,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { useIdentidad } from '../lib/identidad.js'
import { tap } from '../lib/native.js'
import { sugerirPlanes, hayApi } from '../sync/api.js'
import Fab from '../components/Fab.jsx'

/**
 * «Ideas»: lo que se repite de un viaje a otro.
 *
 * Un plan era dos cosas en la misma fila —la idea, que vuelve cada verano, y la
 * propuesta de este año, con su día, su estado y sus votos—, así que reutilizar
 * uno del viaje pasado habría arrastrado el 10 de agosto de entonces y los votos
 * de gente que este año no viene. Aquí vive solo lo primero.
 *
 * Es la misma figura que Platos ↔ Cenas: un catálogo, y lo que se hace con él.
 * Decidido en `docs/diseño/planes-catalogo.html` (A3 · B3 · C1) y afinado en
 * `docs/diseño/planes-votar.html`.
 *
 * **Se toca la fila para editarla.** El lápiz de la derecha competía por el
 * pulgar con «Proponer», que es lo que se viene a hacer, y gastaba 44 pt de un
 * ancho de 390.
 */
export default function IdeasScreen({ eventId, event }) {
  const ideas = useLiveQuery(() => listPlanIdeas(event), [event?.id, event?.esDemo], [])
  const usos = useLiveQuery(usoDeIdeas, [], {})
  const propuestas = useLiveQuery(() => ideasYaPropuestas(eventId), [eventId], new Set())
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { meId } = useIdentidad(eventId, persons)
  const [editando, setEditando] = useState(null) // la idea, o 'nueva'
  const [sugiriendo, setSugiriendo] = useState(false)

  const quien = (id) => persons.find((p) => p.id === id)
  const nombreDe = (id) => { const p = quien(id); return p ? (p.apodo || p.name) : null }

  async function proponer(idea) {
    tap()
    await traerIdeaAlViaje(eventId, idea)
  }

  return (
    <div className="body">
      <div className="note">
        Las ideas son <b>las mismas en todos los viajes</b>. Al proponer una se copia a este evento
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
          {ideas.map((idea) => {
            const yaEsta = propuestas.has(idea.id)
            const autor = nombreDe(idea.creadaPor)
            const viajes = usos[idea.id]
            return (
              <div className="row fila-idea" key={idea.id}>
                {/* La fila entera edita. El verbo va aparte y no se traga el toque. */}
                <button className="main destapa" onClick={() => { tap(); setEditando(idea) }}>
                  <div className="n">{idea.titulo}</div>
                  <div className="sub">
                    {[
                      autor ? `la apuntó ${autor}` : null,
                      viajes ? `${viajes} ${viajes === 1 ? 'viaje' : 'viajes'}` : null,
                    ].filter(Boolean).join(' · ') || 'sin usar todavía'}
                  </div>
                </button>
                <button className="btn sm" disabled={yaEsta} onClick={() => proponer(idea)}>
                  {yaEsta ? 'Ya propuesta' : 'Proponer'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Sugerencias eventId={eventId} evento={event} meId={meId} abierto={sugiriendo} onAbrir={setSugiriendo} />

      <Fab label="Idea" onClick={() => setEditando('nueva')} />
      {editando && (
        <ModalIdea
          idea={editando === 'nueva' ? null : editando}
          evento={event}
          meId={meId}
          usos={editando === 'nueva' ? 0 : (usos[editando.id] ?? 0)}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

/**
 * «¿Qué podríamos hacer?» — una tanda de cinco (`planes-votar.html` · S2).
 *
 * Cinco de una vez porque lo caro de la llamada es contarle al modelo el
 * contexto del viaje; pasar de una propuesta a otra no vuelve a pedir nada. Cada
 * una trae **qué** y **por qué**, que es lo que deja decidir sin abrirla.
 *
 * El botón **no aparece** si esta instalación no habla con la API o si no hay
 * clave puesta: ofrecer algo que va a fallar al pulsarlo es peor que no
 * ofrecerlo. Ver SPECS §14.19.
 */
function Sugerencias({ eventId, evento, meId, abierto, onAbrir }) {
  const [tanda, setTanda] = useState([])
  const [indice, setIndice] = useState(0)
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState(null)
  const [guardadas, setGuardadas] = useState(() => new Set())
  // Sin API no hay a quién preguntar, así que el botón no existe. La
  // configuración se lee en caliente, de ahí que llegue después del primer
  // pintado en vez de estar horneada en el bundle.
  const [disponible, setDisponible] = useState(false)
  useEffect(() => {
    let vivo = true
    hayApi().then((si) => { if (vivo) setDisponible(si) })
    return () => { vivo = false }
  }, [])

  async function pedir(mas = false) {
    tap()
    setPensando(true)
    setError(null)
    onAbrir(true)
    try {
      const nuevas = await sugerirPlanes(eventId, mas ? tanda.map((p) => p.que) : [])
      if (!nuevas.length) setError('No ha propuesto nada. Prueba otra vez.')
      else { setTanda(nuevas); setIndice(0) }
    } catch (e) {
      setError(String(e.message ?? e))
    }
    setPensando(false)
  }

  async function guardar(propuesta) {
    tap()
    await addPlanIdea({ titulo: propuesta.que, descripcion: propuesta.porque, creadaPor: meId }, evento)
    setGuardadas(new Set([...guardadas, propuesta.que]))
  }

  if (!disponible) return null

  if (!abierto) {
    return (
      <button className="btn ghost block" onClick={() => pedir(false)}>
        ✨ ¿Qué podríamos hacer?
      </button>
    )
  }

  const actual = tanda[indice]
  return (
    <div className="propuesta">
      {pensando && <div className="propuesta-texto">Pensando…</div>}
      {!pensando && error && <div className="note" role="alert">{error}</div>}
      {!pensando && actual && (
        <>
          <div className="propuesta-texto">
            <div className="propuesta-que">{actual.que}</div>
            {actual.porque && <div className="propuesta-porque">{actual.porque}</div>}
          </div>
          <div className="propuesta-pie">
            <button className="btn sm ghost" disabled={indice === 0} aria-label="Anterior" onClick={() => { tap(); setIndice(indice - 1) }}>‹</button>
            <span className="propuesta-cuenta tnum">{indice + 1} / {tanda.length}</span>
            <button className="btn sm ghost" disabled={indice >= tanda.length - 1} aria-label="Siguiente" onClick={() => { tap(); setIndice(indice + 1) }}>›</button>
            <button className="btn sm" disabled={guardadas.has(actual.que)} onClick={() => guardar(actual)}>
              {guardadas.has(actual.que) ? '✓ guardada' : 'Guardarla'}
            </button>
          </div>
        </>
      )}
      <div className="propuesta-pie">
        <button className="btn sm ghost" disabled={pensando} onClick={() => pedir(true)}>Otras cinco</button>
        <button className="btn sm ghost" onClick={() => { tap(); onAbrir(false) }}>Cerrar</button>
      </div>
    </div>
  )
}

/**
 * El editor: un modal fino, porque son dos campos.
 *
 * La descripción es lo único largo y por eso crece a cuatro renglones: ahí cabe
 * «llevar sombrilla, no hay chiringuito y aparcar arriba», que es lo que se
 * apunta de verdad. El «dónde» se fue —cabía en la descripción— y el coste
 * también, que no se usó nunca.
 */
function ModalIdea({ idea, evento, meId, usos, onClose }) {
  useBloqueoDeScroll()
  const [titulo, setTitulo] = useState(idea?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(idea?.descripcion ?? '')
  const [enlace, setEnlace] = useState(idea?.enlace ?? '')
  const [confirmando, setConfirmando] = useState(false)

  async function guardar() {
    if (!titulo.trim()) return
    tap()
    const campos = { titulo: titulo.trim(), descripcion: descripcion.trim(), enlace: enlace.trim() }
    if (idea) await updatePlanIdea(idea.id, campos)
    // Quién la apuntó solo se pone al crearla: editarla no cambia de quién fue.
    else await addPlanIdea({ ...campos, creadaPor: meId }, evento)
    onClose()
  }

  async function borrar() {
    tap()
    await removePlanIdea(idea.id)
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fino" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{idea ? 'Editar idea' : 'Idea nueva'}</h2>

        <label htmlFor="idea-titulo">Qué es</label>
        <input id="idea-titulo" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Playa de la Cala" autoFocus />

        <label htmlFor="idea-desc">Descripción</label>
        <textarea id="idea-desc" rows="4" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Cala del sur. Llevar sombrilla: no hay chiringuito." />

        <label htmlFor="idea-enlace">Enlace</label>
        <input id="idea-enlace" type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />

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
                    ? `Los planes de ${usos === 1 ? 'el viaje' : `los ${usos} viajes`} donde ya la propusiste se quedan como están: son copias.`
                    : 'Todavía no la has propuesto en ningún viaje.'}
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
