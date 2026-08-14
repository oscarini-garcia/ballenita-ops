import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listPlanIdeas, addPlanIdea, updatePlanIdea, removePlanIdea,
  traerIdeaAlViaje, usoDeIdeas, ideasYaPropuestas, personsOf, familiesOf,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { useIdentidad } from '../lib/identidad.js'
import { puedeOrganizar } from '../lib/personas.js'
import Alias from '../components/Alias.jsx'
import { formatearHace } from '../lib/hace.js'
import { tap } from '../lib/native.js'
import { sugerirPlanes, hayApi, mejorarIdea } from '../sync/api.js'
import Icono from '../components/Icono.jsx'
import BotonIA from '../components/BotonIA.jsx'
import { useIaDisponible } from '../lib/ia.js'

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
 * `docs/diseño/planes-votar.html` y `docs/diseño/planes-ideas.html`.
 *
 * Lo que trae la última vuelta (`planes-ideas.html` · A1 · B3 · F2 · C1+C3):
 *
 * - **Dos grupos, como en Planes**: «Propuestas» —las que ya están a votación en
 *   este viaje— y «Posibles». Era una lista plana en orden de guardado, y lo
 *   único que separaba a unas de otras era un botón apagado.
 * - **Cada idea la firma quien la apuntó**, con el alias de su familia en una
 *   pastilla de su color y el «cuándo» en palabras. Dos letras se leen de lejos;
 *   «García» no cabe al lado de un nombre y una fecha en una línea de 15,7 pt.
 * - **La fecha es la del grupo** (F2): en Propuestas, cuándo se propuso a este
 *   viaje; en Posibles, cuándo se apuntó al catálogo. Son dos hechos distintos y
 *   cada grupo pregunta por uno.
 * - **Se apunta desde un renglón fijo bajo el mando**, no desde un modal. El
 *   modal medía 455,4 pt de los 508 que quedan sobre el teclado: se escribía sin
 *   ver el catálogo, que es justo lo que evita apuntar dos veces lo mismo.
 *
 * **Se toca la fila para editarla.** El lápiz de la derecha competía por el
 * pulgar con «Proponer», que es lo que se viene a hacer, y gastaba 44 pt de un
 * ancho de 390.
 */
export default function IdeasScreen({ eventId, event }) {
  const ideas = useLiveQuery(() => listPlanIdeas(event), [event?.id, event?.esDemo], [])
  const usos = useLiveQuery(usoDeIdeas, [], {})
  const propuestas = useLiveQuery(() => ideasYaPropuestas(eventId), [eventId], new Map())
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const { meId, me } = useIdentidad(eventId, persons)
  // Apuntar una idea es de todos —es media razón de ser del catálogo—, pero
  // **pasarla a propuesta** crea un plan del viaje y eso lo hacen los adultos
  // (SPECS §14.43). Sin identidad no se capa: libreta local y demostración.
  const organiza = puedeOrganizar(me)
  const [editando, setEditando] = useState(null)
  const [sugiriendo, setSugiriendo] = useState(false)

  // Propuestas primero, y dentro por lo más reciente: en ese grupo la pregunta
  // es «¿qué se ha sacado ya?», y lo de esta semana manda sobre lo de julio.
  const yaEstan = ideas.filter((i) => propuestas.has(i.id))
    .sort((a, b) => (propuestas.get(b.id)?.propuestoEl ?? '').localeCompare(propuestas.get(a.id)?.propuestoEl ?? ''))
  // Las posibles llegan ya ordenadas por nombre desde `listPlanIdeas`: sin votos
  // ni fecha de propuesta, el nombre es el único orden que no cambia solo.
  const posibles = ideas.filter((i) => !propuestas.has(i.id))

  async function proponer(idea) {
    tap()
    await traerIdeaAlViaje(eventId, idea)
  }

  return (
    <div className="body">
      <RenglonNuevaIdea evento={event} meId={meId} />

      {ideas.length === 0 && (
        <div className="empty">
          <span className="e">🗺️</span>Todavía no hay ideas guardadas.<br />
          Apunta la primera ahí arriba, o guarda un plan desde Planes.<br />
          Las buenas se apuntan en la sobremesa y se olvidan al día siguiente.
        </div>
      )}

      {yaEstan.length > 0 && (
        <>
          <div className="sec-h"><span>Propuestas · {yaEstan.length}</span><span>a este viaje</span></div>
          <div className="card tight">
            {yaEstan.map((idea) => (
              <Fila
                key={idea.id}
                idea={idea}
                cuando={propuestas.get(idea.id)?.propuestoEl}
                persons={persons}
                families={families}
                onEditar={() => { tap(); setEditando(idea) }}
              />
            ))}
          </div>
        </>
      )}

      {posibles.length > 0 && (
        <>
          <div className="sec-h"><span>Posibles · {posibles.length}</span><span>por nombre</span></div>
          <div className="card tight">
            {posibles.map((idea) => (
              <Fila
                key={idea.id}
                idea={idea}
                cuando={idea.apuntadaEl}
                persons={persons}
                families={families}
                onEditar={() => { tap(); setEditando(idea) }}
                onProponer={organiza ? () => proponer(idea) : null}
              />
            ))}
          </div>
        </>
      )}

      <Sugerencias eventId={eventId} evento={event} meId={meId} abierto={sugiriendo} onAbrir={setSugiriendo} />

      {editando && (
        <ModalIdea
          idea={editando}
          usos={usos[editando.id] ?? 0}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

/**
 * Una idea, en una fila de 67,1 pt.
 *
 * Vive **fuera** del componente a propósito: declarada dentro, cada pintado
 * creaba un tipo nuevo y React desmontaba y volvía a montar la lista entera. Con
 * seis consultas vivas encima eso llega a tragarse un toque —la fila se cambia
 * por otra igual entre que baja el dedo y se levanta—.
 *
 * El verbo va aparte del cuerpo para que la fila entera pueda editar sin
 * tragarse el toque de «Proponer». En el grupo de arriba no hay verbo: el
 * encabezado ya dice que está propuesta, y el botón apagado de antes gastaba
 * 144,2 pt de un ancho de 390 para no hacer nada.
 */
function Fila({ idea, cuando, persons, families, onEditar, onProponer }) {
  return (
    <div className="row fila-idea">
      <button className="main destapa" onClick={onEditar}>
        <div className="n">{idea.titulo}</div>
        <div className="sub">
          <Firma idea={idea} persons={persons} families={families} cuando={cuando} />
        </div>
      </button>
      {onProponer && <button className="btn sm" onClick={onProponer}>Proponer</button>}
    </div>
  )
}

/**
 * Quién apuntó la idea y cuándo (`docs/diseño/planes-ideas.html` · B3).
 *
 * El alias va en pastilla y con el color de su familia (`components/Alias.jsx`),
 * no en texto corrido: «Curro GA» leído deprisa parece un apellido, y lo que se
 * quiere es que tres ideas de la misma familia se vean **sin leer ningún
 * nombre**.
 *
 * Sin autor —una idea traída de la IA o importada— se dice «sin autor» y punto:
 * es cierto, y es mejor que inventarse a alguien.
 */
function Firma({ idea, persons, families, cuando }) {
  const quien = persons.find((p) => p.id === idea.creadaPor)
  const familia = quien ? families.find((f) => f.id === quien.familyId) : null
  const cuandoTexto = formatearHace(cuando)

  return (
    <>
      {quien ? (
        <>
          {quien.apodo || quien.name}
          <Alias familia={familia} />
        </>
      ) : 'sin autor'}
      {cuandoTexto && ` · ${cuandoTexto}`}
    </>
  )
}

/**
 * El renglón de apuntar, bajo el mando de áreas
 * (`docs/diseño/planes-ideas.html` · C1 + C3).
 *
 * Dos medidas explican por qué no es un modal: el de antes ocupaba **455,4 pt**
 * de los 508 que quedan sobre el teclado —la lista se veía cero— y este deja
 * **258,2**, que son tres ideas. Se escribe viendo lo que ya hay apuntado, que
 * es lo único que evita apuntar dos veces la misma cosa.
 *
 * Al guardar **no se cierra**: se vacía y se queda enfocado. Apuntar tres ideas
 * seguidas son tres frases y tres toques.
 *
 * «Más detalles» crece **hacia abajo** (C3): lo que empuja es la lista, nunca el
 * campo que se está mirando. Y el ✓ está apagado mientras no hay título, que no
 * es adorno: sin eso, un toque en vacío guarda una idea sin nombre.
 */
function RenglonNuevaIdea({ evento, meId }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enlace, setEnlace] = useState('')
  const [detalles, setDetalles] = useState(false)
  const campo = useRef(null)

  async function guardar(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    tap()
    await addPlanIdea({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      enlace: enlace.trim(),
      creadaPor: meId,
    }, evento)
    setTitulo('')
    setDescripcion('')
    setEnlace('')
    setDetalles(false)
    campo.current?.focus()
  }

  return (
    <form className="renglon" onSubmit={guardar}>
      <div className="renglon-linea">
        <input
          ref={campo}
          type="text"
          aria-label="Apunta una idea"
          placeholder="Apunta una idea…"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <button className="btn cuadrado" type="submit" disabled={!titulo.trim()} aria-label="Guardar idea">
          <Icono nombre="visto" />
        </button>
      </div>

      <button
        type="button"
        className="renglon-mas"
        aria-expanded={detalles}
        onClick={() => { tap(); setDetalles(!detalles) }}
      >
        {detalles ? 'Menos detalles ▴' : 'Más detalles ▾'}
      </button>

      {detalles && (
        <>
          <label htmlFor="idea-nueva-desc">Descripción</label>
          <textarea
            id="idea-nueva-desc"
            rows="3"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Cala del sur. Llevar sombrilla: no hay chiringuito."
          />
          <label htmlFor="idea-nueva-enlace">Enlace</label>
          <input
            id="idea-nueva-enlace"
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://…"
          />
        </>
      )}
    </form>
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
 * Solo **edita**: lo de crear se hace en el renglón de arriba, sin tapar nada.
 * La descripción es lo único largo y por eso crece a cuatro renglones: ahí cabe
 * «llevar sombrilla, no hay chiringuito y aparcar arriba», que es lo que se
 * apunta de verdad. El «dónde» se fue —cabía en la descripción— y el coste
 * también, que no se usó nunca.
 *
 * **«Mejorarla»** (SPECS §14.24) es la figura de «Arreglar» del editor de
 * receta: un botón de IA que devuelve el título y la descripción mejor
 * contados, rellena los campos **sin guardar nada** y **se deshace**. Guardar
 * sigue siendo el botón de siempre, y tocar un campo a mano retira el
 * deshacer, porque lo escrito ya es tuyo y no del modelo.
 */
function ModalIdea({ idea, usos, onClose }) {
  useBloqueoDeScroll()
  const [titulo, setTitulo] = useState(idea.titulo ?? '')
  const [descripcion, setDescripcion] = useState(idea.descripcion ?? '')
  const [enlace, setEnlace] = useState(idea.enlace ?? '')
  const [confirmando, setConfirmando] = useState(false)
  const [pensando, setPensando] = useState(false)
  const [falloIA, setFalloIA] = useState(null)
  // Cómo estaba antes de mejorarla, para poder deshacer (la R1 de la receta).
  const [antes, setAntes] = useState(null)
  const ia = useIaDisponible()

  async function guardar() {
    if (!titulo.trim()) return
    tap()
    // Quién la apuntó no se toca al editar: editarla no cambia de quién fue.
    await updatePlanIdea(idea.id, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      enlace: enlace.trim(),
    })
    onClose()
  }

  async function borrar() {
    tap()
    await removePlanIdea(idea.id)
    onClose()
  }

  async function pulir() {
    tap()
    setPensando(true)
    setFalloIA(null)
    try {
      const nueva = await mejorarIdea({ titulo, descripcion, enlace })
      if (!nueva?.titulo) {
        setFalloIA('No ha sabido mejorarla.')
        return
      }
      setAntes({ titulo, descripcion })
      setTitulo(nueva.titulo)
      setDescripcion(nueva.descripcion ?? descripcion)
    } catch (e) {
      setFalloIA(String(e.message ?? e))
    } finally {
      setPensando(false)
    }
  }

  return (
    // Centrado y sin robar el foco: se abre a **leer** —la firma, el contador,
    // los verbos—, no a escribir, así que el teclado no sale hasta tocar un
    // campo. Y sin teclado que lo pelee, centrado se lee mejor que pegado a
    // ningún borde.
    <div className="modal-bg center" onClick={onClose}>
      <div className="modal fino center" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>Editar idea</h2>
        {/* El contador de viajes vive aquí y ya no en la fila: en una línea de
            15,7 pt no caben el autor, la familia, la fecha y el contador, y de
            los cuatro es el menos accionable (`planes-ideas.html`, defecto 5). */}
        <div className="dato-fijo">
          {usos === 0
            ? 'Todavía no la has propuesto en ningún viaje.'
            : `Propuesta en ${usos} ${usos === 1 ? 'viaje' : 'viajes'}.`}
        </div>

        <label htmlFor="idea-titulo">Qué es</label>
        <input id="idea-titulo" type="text" value={titulo} onChange={(e) => { setTitulo(e.target.value); setAntes(null) }} placeholder="Playa de la Cala" />

        <label htmlFor="idea-desc">Descripción</label>
        <textarea id="idea-desc" rows="4" value={descripcion} onChange={(e) => { setDescripcion(e.target.value); setAntes(null) }} placeholder="Cala del sur. Llevar sombrilla: no hay chiringuito." />

        <label htmlFor="idea-enlace">Enlace</label>
        <input id="idea-enlace" type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />

        {/* El botón no aparece donde nunca va a funcionar (web, sin clave); el
            motivo se dice en palabras, como en el editor de receta. */}
        <div style={{ marginTop: 12 }}>
          <BotonIA
            pensando={pensando}
            disabled={pensando || !ia.puede || !titulo.trim()}
            onClick={pulir}
          >🐳 Mejorarla</BotonIA>
        </div>
        {ia.motivo && <div className="pista" style={{ marginTop: 8 }}>{ia.motivo}</div>}
        {falloIA && <div className="note" role="alert" style={{ marginTop: 8 }}>{falloIA}</div>}
        {antes && (
          <div className="pista" role="status" style={{ marginTop: 8 }}>
            Mejorada con la IA; no se guarda hasta que pulses Guardar.{' '}
            <button className="como-enlace" onClick={() => { tap(); setTitulo(antes.titulo); setDescripcion(antes.descripcion); setAntes(null) }}>
              deshacer
            </button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={guardar} disabled={!titulo.trim()}>Guardar</button>
        </div>

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
      </div>
    </div>
  )
}
