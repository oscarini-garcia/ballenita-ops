// Trucos: lo que hay que acordarse de un viaje a otro (SPECS §14.53).
//
// **Compartido entre eventos**, como los platos y las ideas de plan: un truco no
// caduca en septiembre. «El súper del pueblo cierra a las 14:00» sigue siendo
// verdad el agosto que viene, y esa es toda la razón de ser de la lista.
//
// **Y no se tacha.** Se dibujó una versión con dos grupos —«Para llevar», que se
// tildaba cada viaje, y «Para saber»— y se descartó: un truco no es una tarea, y
// tildarlo obligaba a una segunda tabla de estado por evento para nada. Lo que
// se pidió es saber, y la lista de la compra ya existe para lo otro.
import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listTrucos, addTruco, updateTruco, removeTruco,
  TOPE_DE_TRUCO, TRUCO_CATEGORIAS, personsOf, familiesOf,
} from '../db.js'
import Deslizable from '../components/Deslizable.jsx'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'
import Hoja from '../components/Hoja.jsx'
import Confirmar from '../components/Confirmar.jsx'
import { formatearHace } from '../lib/hace.js'
import { useIdentidad } from '../lib/identidad.js'
import { tap } from '../lib/native.js'

const catDe = (id) => TRUCO_CATEGORIAS.find((c) => c.id === id) ?? TRUCO_CATEGORIAS.at(-1)

export default function TrucosScreen({ eventId, event }) {
  const trucos = useLiveQuery(() => listTrucos(event), [event?.id, event?.esDemo], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const { meId } = useIdentidad(eventId, persons)
  // `{ truco, confirmando }` — el verbo Borrar abre la misma hoja que Editar con
  // la pregunta puesta, como en Mejoras: la pregunta es la protección.
  const [abierto, setAbierto] = useState(null)

  // Agrupados por categoría, en el orden del catálogo. Con quince trucos las
  // categorías sobran y con sesenta son lo que hace que se encuentren; el coste
  // de tenerlas desde el principio es un encabezado por grupo.
  const grupos = useMemo(() => TRUCO_CATEGORIAS
    .map((cat) => ({ cat, list: trucos.filter((t) => (t.categoria ?? 'otros') === cat.id) }))
    .filter((g) => g.list.length > 0), [trucos])

  return (
    <div className="body">
      <RenglonNuevoTruco evento={event} meId={meId} />

      {trucos.length === 0 && (
        <div className="empty">
          <span className="e">🧭</span>Todavía no hay ningún truco.<br />
          Lo que aprendisteis el año pasado y no está escrito en ninguna parte.<br />
          Estos no se borran al acabar el viaje: valen para el siguiente.
        </div>
      )}

      {grupos.map(({ cat, list }) => (
        <div key={cat.id}>
          <div className="sec-h"><span>{cat.icon} {cat.label}</span><span>{list.length}</span></div>
          <div className="card tight">
            {list.map((truco) => (
              <Deslizable
                key={truco.id}
                verbos={(
                  <>
                    <button className="verbo editar" onClick={() => setAbierto({ truco, confirmando: false })}>
                      <Icono nombre="lapiz" className="g" />Editar
                    </button>
                    <button className="verbo borrar" onClick={() => setAbierto({ truco, confirmando: true })}>
                      <Icono nombre="papelera" className="g" />Borrar
                    </button>
                  </>
                )}
              >
                <Fila
                  truco={truco}
                  persons={persons}
                  families={families}
                  onAbrir={() => { tap(); setAbierto({ truco, confirmando: false }) }}
                />
              </Deslizable>
            ))}
          </div>
        </div>
      ))}

      {trucos.length > 0 && (
        <div className="pista">
          Los ve todo el grupo, y <b>siguen aquí el año que viene</b>: no cuelgan de este viaje.
        </div>
      )}

      {abierto && (
        <HojaDeTruco
          truco={abierto.truco}
          confirmando={abierto.confirmando}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

/**
 * Un truco: el texto entero y quién lo apuntó.
 *
 * Sin casilla delante y con el texto envolviendo, que es la diferencia con una
 * mejora: aquí no hay nada que tachar y lo que se apunta son frases —«pedir el
 * bunga del fondo, que tiene sombra toda la tarde»— y no títulos.
 */
function Fila({ truco, persons, families, onAbrir }) {
  const quien = persons.find((p) => p.id === truco.autorId)
  const familia = quien ? families.find((f) => f.id === quien.familyId) : null
  const cuando = formatearHace(truco.apuntadoEl)
  return (
    <div className="row">
      <button className="main destapa" onClick={onAbrir}>
        <div className="n envuelve">{truco.texto}</div>
        <div className="sub">
          {quien ? <>{quien.apodo || quien.name}<Alias familia={familia} /></> : 'sin autor'}
          {cuando && ` · ${cuando}`}
        </div>
      </button>
    </div>
  )
}

/**
 * El renglón de apuntar, el mismo gesto que en Ideas y en Mejoras: siempre
 * puesto, y al guardar **no se cierra** — se vacía y se queda enfocado.
 *
 * Con su categoría al lado, porque elegirla después obligaría a abrir la hoja
 * de algo que se acaba de escribir.
 */
function RenglonNuevoTruco({ evento, meId }) {
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('otros')
  const campo = useRef(null)

  async function guardar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    tap()
    await addTruco({ texto: texto.trim(), categoria, autorId: meId }, evento)
    setTexto('')
    campo.current?.focus()
  }

  return (
    <form className="renglon" onSubmit={guardar}>
      <div className="renglon-linea">
        <input
          ref={campo}
          type="text"
          aria-label="Apunta un truco"
          placeholder="Lo que no hay que volver a olvidar…"
          maxLength={TOPE_DE_TRUCO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="btn cuadrado" type="submit" disabled={!texto.trim()} aria-label="Guardar truco">
          <Icono nombre="visto" />
        </button>
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {TRUCO_CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${categoria === c.id ? ' on' : ''}`}
            aria-pressed={categoria === c.id}
            onClick={() => { tap(); setCategoria(c.id) }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>
    </form>
  )
}

/** La hoja de un truco: su texto, su categoría y quitarlo. */
function HojaDeTruco({ truco, confirmando: confirmandoInicial, onClose }) {
  const [texto, setTexto] = useState(truco?.texto ?? '')
  const [categoria, setCategoria] = useState(truco?.categoria ?? 'otros')
  const [confirmando, setConfirmando] = useState(Boolean(confirmandoInicial))

  return (
    <Hoja titulo="Editar truco" onCerrar={onClose}>
      <label htmlFor="truco-texto">El truco</label>
      <textarea
        id="truco-texto"
        rows={4}
        maxLength={TOPE_DE_TRUCO}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <label>Dónde sirve</label>
      <div className="chips">
        {TRUCO_CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${categoria === c.id ? ' on' : ''}`}
            aria-pressed={categoria === c.id}
            onClick={() => { tap(); setCategoria(c.id) }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {confirmando ? (
        <Confirmar
          queSeLleva={`Se va de la lista de todo el grupo, y de los próximos viajes: «${catDe(categoria).label}» se queda sin él.`}
          onDejarlo={() => { tap(); setConfirmando(false) }}
          onBorrar={async () => { tap(); await removeTruco(truco.id); onClose() }}
        />
      ) : (
        <div className="grid2" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={() => { tap(); setConfirmando(true) }}>Borrar</button>
          <button
            type="button"
            className="btn"
            disabled={!texto.trim()}
            onClick={async () => {
              tap()
              await updateTruco(truco.id, { texto: texto.trim(), categoria })
              onClose()
            }}
          >
            Guardar
          </button>
        </div>
      )}
    </Hoja>
  )
}
