import { useRef, useState } from 'react'
import { addMejora, updateMejora, removeMejora, TOPE_DE_MEJORA } from '../db.js'
import Deslizable from '../components/Deslizable.jsx'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'
import { formatearHace } from '../lib/hace.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'

/**
 * «Mejoras»: el roadmap de la app, apuntado desde el móvil.
 *
 * La figura es el bloque «Mejoras» de `garciadoral-ops` y la decisión entera
 * está en `docs/diseño/mejoras.html` (A1 · B1 · C2 · D2 · E1 · F2): antes el
 * roadmap vivía en un fichero del repositorio que el grupo no lee ni puede
 * tocar, y una idea dicha en una cena se perdía por el camino.
 *
 * - **Se apunta desde un renglón fijo** (B1), el mismo gesto que las ideas de
 *   plan: la lista queda a la vista mientras se escribe —que es lo que evita
 *   apuntar la que ya está— y al guardar no se cierra.
 * - **El visto delante y deslizar descubre Editar y Borrar** (C2): tachar es el
 *   verbo de cada día y queda a un toque; los otros dos, en el gesto que la app
 *   ya enseñó en Gastos. Tocar el texto abre la mejora, para quien no lo conoce.
 * - **Lo hecho se tacha y baja al final** — una lista que se mira para saber
 *   qué queda no debe empezar por lo que ya no queda.
 * - **La firma es la de Ideas** (D2): nombre + alias de su familia en pastilla
 *   de su color + cuándo en palabras. Las dos listas del proyecto que dicen
 *   «quién apuntó esto» se leen igual.
 * - **Cualquiera puede todo** (E1), como con los gastos y las cenas; lo único
 *   que protege el quitar es la pregunta, que dice a quién afecta.
 */
export default function MejorasSection({ evento, mejoras, persons, families, meId }) {
  // `{ mejora, confirmando }`: el verbo Borrar del deslizado abre la misma hoja
  // que Editar pero con la pregunta ya puesta — la pregunta es la protección
  // (E1), así que ningún camino se la salta.
  const [abierta, setAbierta] = useState(null)
  const quedan = mejoras.filter((m) => !m.hecho).length

  return (
    <>
      <RenglonNuevaMejora evento={evento} meId={meId} />

      {mejoras.length > 0 && (
        <div className="card tight">
          {mejoras.map((mejora) => (
            <Deslizable
              key={mejora.id}
              verbos={
                <>
                  <button className="verbo editar" onClick={() => setAbierta({ mejora, confirmando: false })}>
                    <Icono nombre="lapiz" className="g" />Editar
                  </button>
                  <button className="verbo borrar" onClick={() => setAbierta({ mejora, confirmando: true })}>
                    <Icono nombre="papelera" className="g" />Borrar
                  </button>
                </>
              }
            >
              <Fila
                mejora={mejora}
                persons={persons}
                families={families}
                onAbrir={() => { tap(); setAbierta({ mejora, confirmando: false }) }}
              />
            </Deslizable>
          ))}
        </div>
      )}

      {/* Quién las ve es la pregunta que esta pantalla no contestaría en ningún
          otro sitio: una mejora que apuntas se le aparece al grupo entero y
          nada lo insinuaría. */}
      <div className="pista">
        {mejoras.length === 0
          ? 'Ideas sobre esta aplicación: lo que falta, lo que molesta, lo que estaría bien. Las ve todo el grupo.'
          : quedan
            ? `${quedan} sin hacer. Las ve todo el grupo.`
            : 'Todas hechas. Las ve todo el grupo.'}
      </div>

      {abierta && (
        <ModalMejora
          mejora={abierta.mejora}
          confirmando={abierta.confirmando}
          onClose={() => setAbierta(null)}
        />
      )}
    </>
  )
}

/**
 * Una mejora: el visto delante y el texto que abre la hoja.
 *
 * Vive fuera del componente por lo mismo que la fila de una idea: declarada
 * dentro, cada pintado crearía un tipo nuevo y React desmontaría la lista.
 */
function Fila({ mejora, persons, families, onAbrir }) {
  const hecha = Boolean(mejora.hecho)
  return (
    <div className={`row fila-mejora${hecha ? ' hecha' : ''}`}>
      <button
        className="mejora-visto"
        aria-pressed={hecha}
        aria-label={hecha ? `Deshacer «${mejora.texto}»` : `Dar por hecha «${mejora.texto}»`}
        onClick={() => { tap(); updateMejora(mejora.id, { hecho: !hecha }) }}
      >
        <span className="aro"><Icono nombre="visto" /></span>
      </button>
      <button className="main destapa" onClick={onAbrir}>
        <div className="n">{mejora.texto}</div>
        <div className="sub"><Firma mejora={mejora} persons={persons} families={families} /></div>
      </button>
    </div>
  )
}

/**
 * Quién la apuntó y cuándo — la firma de Ideas (D2, §14.19-ter), con las
 * mismas piezas: el alias en pastilla del color de su familia y el «hace» en
 * palabras. Sin autor se dice «sin autor», que es cierto.
 */
function Firma({ mejora, persons, families }) {
  const quien = persons.find((p) => p.id === mejora.autorId)
  const familia = quien ? families.find((f) => f.id === quien.familyId) : null
  const cuando = formatearHace(mejora.apuntadaEl)
  return (
    <>
      {quien ? (
        <>
          {quien.apodo || quien.name}
          <Alias familia={familia} />
        </>
      ) : 'sin autor'}
      {cuando && ` · ${cuando}`}
    </>
  )
}

/**
 * El renglón de apuntar (B1), el gesto del de Ideas: siempre puesto, y al
 * guardar **no se cierra** — se vacía y se queda enfocado, así que dos mejoras
 * seguidas son dos frases y dos toques. El tope se corta aquí con `maxLength` y
 * lo vuelve a mirar `addMejora`; el Worker rechaza lo que se le cuele.
 */
function RenglonNuevaMejora({ evento, meId }) {
  const [texto, setTexto] = useState('')
  const campo = useRef(null)

  async function guardar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    tap()
    await addMejora({ texto: texto.trim(), autorId: meId }, evento)
    setTexto('')
    campo.current?.focus()
  }

  return (
    <form className="renglon" onSubmit={guardar}>
      <div className="renglon-linea">
        <input
          ref={campo}
          type="text"
          aria-label="Apunta una mejora"
          placeholder="Se te ha ocurrido algo…"
          maxLength={TOPE_DE_MEJORA}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="btn cuadrado" type="submit" disabled={!texto.trim()} aria-label="Guardar mejora">
          <Icono nombre="visto" />
        </button>
      </div>
    </form>
  )
}

/**
 * La hoja de una mejora: editar el texto y, aparte, quitarla.
 *
 * Solo edita el texto — quién la apuntó no se toca al editar, y `hecho` ya
 * tiene su casilla en la fila. Quitar pregunta **diciendo a quién afecta**
 * (E1): cualquiera puede quitar la de cualquiera, y eso se dice antes y no se
 * descubre después. Quitar es `borrado = 1` en el servidor, no una destrucción.
 */
function ModalMejora({ mejora, confirmando: confirmandoInicial, onClose }) {
  useBloqueoDeScroll()
  const [texto, setTexto] = useState(mejora.texto ?? '')
  const [confirmando, setConfirmando] = useState(confirmandoInicial)

  async function guardar() {
    if (!texto.trim()) return
    tap()
    await updateMejora(mejora.id, { texto: texto.trim() })
    onClose()
  }

  async function quitar() {
    tap()
    await removeMejora(mejora.id)
    onClose()
  }

  return (
    // Pegado arriba y sin robar el foco, como el editor de una idea: se abre a
    // leer o a quitar tanto como a escribir, y el teclado no sale hasta que se
    // toca el campo. Las dos hojas hermanas se comportan igual.
    <div className="modal-bg arriba" onClick={onClose}>
      <div className="modal fino arriba" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>Mejora</h2>

        <label htmlFor="mejora-texto">Qué se te ha ocurrido</label>
        <textarea
          id="mejora-texto"
          rows="4"
          maxLength={TOPE_DE_MEJORA}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={guardar} disabled={!texto.trim()}>Guardar</button>
        </div>

        <div style={{ marginTop: 10 }}>
          {confirmando ? (
            <>
              <div className="note">¿Quitar esta mejora? Se va de la lista de todo el grupo.</div>
              <div className="chips" style={{ marginTop: 8 }}>
                <button className="btn sm danger" onClick={quitar}>Sí, quitarla</button>
                <button className="btn sm ghost" onClick={() => setConfirmando(false)}>Dejarlo</button>
              </div>
            </>
          ) : (
            <button className="btn sm ghost block" onClick={() => { tap(); setConfirmando(true) }}>Quitar mejora</button>
          )}
        </div>
      </div>
    </div>
  )
}
