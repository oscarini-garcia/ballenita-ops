// El hilo de cualquier cosa, enchufable donde haga falta (SPECS §14.55).
//
// Se pone con `<Comentarios eventId ancla />` y ya: el ancla es `'plan:abc'`,
// `'gasto:def'`, `'dia:2026-08-15'`. Ése es todo el motivo de que los
// comentarios sean una tabla con ancla y no una columna por tabla — el octavo
// sitio donde se enchufe cuesta tres líneas y no una migración.
//
// **Se enseñan los dos últimos y el resto detrás de un renglón** (K2). La capa
// de un plan mide 470 pt y con el hilo entero dentro pasa de 900, así que habría
// que rodar dentro de un modal para llegar a escribir. Con dos crece 130 pt y se
// para ahí, con ocho comentarios o con ochenta. Es la figura del recap (§14.50),
// donde el diario vive detrás de «ver todo».
//
// **`sugerir` es opcional y lo pone quien enchufa el hilo** (§14.66-quater). El
// componente no sabe de bungas ni de evaluaciones: recibe una función, y si la
// recibe pinta el botón de la ballena y le pasa lo único que él tiene y quien
// enchufa no —lo que ya se ha dicho en el hilo y lo que ya ha propuesto—. Hoy lo
// pasa el bunga; el plan y el gasto no, porque no tienen de qué hablar.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  comentariosDe, addComentario, removeComentario, personsOf, familiesOf, TOPE_DE_COMENTARIO,
} from '../db.js'
import { marcarLeido, ultimoDe, ultimos } from '../lib/comentarios.js'
import { useIdentidad } from '../lib/identidad.js'
import { formatearHace } from '../lib/hace.js'
import { tap } from '../lib/native.js'
import Alias from './Alias.jsx'
import Icono from './Icono.jsx'
import Hoja from './Hoja.jsx'

export default function Comentarios({ eventId, ancla, titulo = 'Comentarios', sugerir = null }) {
  const hilo = useLiveQuery(() => comentariosDe(eventId, ancla), [eventId, ancla], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const { meId } = useIdentidad(eventId, persons)
  const [texto, setTexto] = useState('')
  const [todos, setTodos] = useState(false)
  // Lo que ha traído el botón de la ballena en esta sesión. No se guarda en
  // ningún sitio: es lo que se le manda al modelo para que el segundo toque
  // traiga otro y no el mismo, y lo que decide si el botón dice «Otro».
  const [propuestas, setPropuestas] = useState([])
  const [pensando, setPensando] = useState(false)
  const [falloIA, setFalloIA] = useState(null)

  // Abrir el hilo lo marca visto **hasta el último que hay**, no hasta «ahora»:
  // uno escrito mientras lo tienes abierto quedaría marcado sin haberlo visto.
  useEffect(() => {
    if (hilo.length) marcarLeido(eventId, ancla, ultimoDe(hilo))
  }, [eventId, ancla, hilo.length])

  async function enviar(e) {
    e?.preventDefault?.()
    const t = texto.trim()
    if (!t) return
    tap()
    await addComentario(eventId, { ancla, texto: t, autorId: meId ?? null })
    setTexto('')
    setPropuestas([])
  }

  /**
   * «Que lo escriba la ballena»: trae un comentario y **lo pone en la casilla**,
   * sin mandarlo. La figura de «Mejorarla» de una idea y de «Más gracioso» del
   * estado — lo que vuelve se corrige, se borra o se manda, y quien lo firma es
   * quien pulsa. Volver a pulsar trae otro distinto, porque se le dicen los que
   * ya ha traído.
   */
  async function proponer() {
    if (!sugerir || pensando) return
    tap()
    setPensando(true)
    setFalloIA(null)
    try {
      const t = await sugerir({ hilo: hilo.map((c) => c.texto), yaPropuestas: propuestas })
      if (!t) setFalloIA('El modelo no ha traído ningún comentario.')
      else {
        setPropuestas((p) => [...p, t])
        setTexto(t)
      }
    } catch (e) {
      setFalloIA(String(e.message ?? e))
    } finally {
      setPensando(false)
    }
  }

  const aLaVista = ultimos(hilo)
  const escondidos = hilo.length - aLaVista.length

  return (
    <>
      <label>{titulo}{hilo.length > 0 ? ` · ${hilo.length}` : ''}</label>

      {hilo.length > 0 && (
        <div className="hilo">
          {aLaVista.map((c) => (
            <Comentario key={c.id} c={c} persons={persons} families={families} meId={meId} />
          ))}
        </div>
      )}

      {escondidos > 0 && (
        <button type="button" className="ver-todos" onClick={() => { tap(); setTodos(true) }}>
          Ver los {hilo.length} comentarios
        </button>
      )}

      <form className="coment-escribir" onSubmit={enviar}>
        <input
          type="text"
          aria-label="Escribe un comentario"
          placeholder={hilo.length ? 'Contesta algo…' : 'Escribe algo…'}
          maxLength={TOPE_DE_COMENTARIO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="coment-enviar" type="submit" disabled={!texto.trim()} aria-label="Enviar comentario">
          <Icono nombre="visto" />
        </button>
      </form>

      {/* Solo donde se enchufa: el hilo de un bunga es el único que sabe de qué
          hablar, porque tiene la evaluación del sitio detrás (§14.66-quater). */}
      {sugerir && (
        <button type="button" className="coment-ia" disabled={pensando} onClick={proponer}>
          {pensando
            ? 'Pensando…'
            : (propuestas.length ? '🐳 Que escriba otro distinto' : '🐳 Que lo escriba la ballena')}
        </button>
      )}
      {falloIA && <pre className="traza mal" role="status">{falloIA}</pre>}

      {todos && (
        <Hoja titulo={titulo} onCerrar={() => setTodos(false)}>
          <div className="hilo">
            {hilo.map((c) => (
              <Comentario key={c.id} c={c} persons={persons} families={families} meId={meId} />
            ))}
          </div>
        </Hoja>
      )}
    </>
  )
}

/**
 * Un comentario: lo que dice, y debajo quién y cuándo (B1). Y el aspa **solo en
 * los tuyos**: borrar lo que escribió otro no es moderar, es reescribir la
 * conversación.
 *
 * El texto va primero y la firma debajo, que es lo que ya hacía: se probó
 * ponerla encima (B2) y se descartó. Lo que cambia es el peso —prosa a 400 en
 * vez del 550 de un titular— y el tamaño de la firma, que baja a `--t-micro`
 * para que la línea de servicio no compita con lo que se dijo.
 */
function Comentario({ c, persons, families, meId }) {
  const [quitando, setQuitando] = useState(false)
  const quien = persons.find((p) => p.id === c.autorId)
  const familia = quien ? families.find((f) => f.id === quien.familyId) : null
  const cuando = formatearHace(c.escritoEl)
  const mio = Boolean(meId) && c.autorId === meId

  return (
    <div className="coment">
      <p className="coment-txt">{c.texto}</p>
      <div className="coment-pie">
        <span className="coment-quien">
          {quien ? <>{quien.apodo || quien.name}<Alias familia={familia} /></> : 'alguien'}
          {cuando && <span className="hace"> · {cuando}</span>}
        </span>
        {mio && (
          <button
            type="button"
            className={`coment-x${quitando ? ' seguro' : ''}`}
            aria-label={quitando ? 'Confirmar que se borra tu comentario' : 'Borrar tu comentario'}
            onClick={() => {
              tap()
              if (quitando) removeComentario(c.id)
              else setQuitando(true)
            }}
          >
            {quitando ? '¿Seguro?' : <Icono nombre="papelera" />}
          </button>
        )}
      </div>
    </div>
  )
}
