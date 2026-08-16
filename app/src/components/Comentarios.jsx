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

export default function Comentarios({ eventId, ancla, titulo = 'Comentarios' }) {
  const hilo = useLiveQuery(() => comentariosDe(eventId, ancla), [eventId, ancla], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const { meId } = useIdentidad(eventId, persons)
  const [texto, setTexto] = useState('')
  const [todos, setTodos] = useState(false)

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
  }

  const aLaVista = ultimos(hilo)
  const escondidos = hilo.length - aLaVista.length

  return (
    <>
      <label>{titulo}{hilo.length > 0 ? ` · ${hilo.length}` : ''}</label>

      {hilo.length > 0 && (
        <div className="card tight">
          {aLaVista.map((c) => (
            <Comentario key={c.id} c={c} persons={persons} families={families} meId={meId} />
          ))}
        </div>
      )}

      {escondidos > 0 && (
        <button type="button" className="acor-ido" onClick={() => { tap(); setTodos(true) }}>
          <span className="main">
            <span className="n">Ver los {hilo.length} comentarios</span>
          </span>
          <span className="v" aria-hidden>›</span>
        </button>
      )}

      <form className="renglon-linea" onSubmit={enviar} style={{ marginTop: 8 }}>
        <input
          type="text"
          aria-label="Escribe un comentario"
          placeholder={hilo.length ? 'Contesta algo…' : 'Escribe algo…'}
          maxLength={TOPE_DE_COMENTARIO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="btn cuadrado" type="submit" disabled={!texto.trim()} aria-label="Enviar comentario">
          <Icono nombre="visto" />
        </button>
      </form>

      {todos && (
        <Hoja titulo={titulo} onCerrar={() => setTodos(false)}>
          <div className="card tight">
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
 * Un comentario: lo que dice, quién y cuándo. Y el aspa **solo en los tuyos**:
 * borrar lo que escribió otro no es moderar, es reescribir la conversación.
 */
function Comentario({ c, persons, families, meId }) {
  const [quitando, setQuitando] = useState(false)
  const quien = persons.find((p) => p.id === c.autorId)
  const familia = quien ? families.find((f) => f.id === quien.familyId) : null
  const cuando = formatearHace(c.escritoEl)
  const mio = Boolean(meId) && c.autorId === meId

  return (
    <div className="row">
      <div className="main">
        <div className="n envuelve">{c.texto}</div>
        <div className="sub">
          {quien ? <>{quien.apodo || quien.name}<Alias familia={familia} /></> : 'alguien'}
          {cuando && ` · ${cuando}`}
        </div>
      </div>
      {mio && (
        <button
          type="button"
          className={`btn sm ghost quitar${quitando ? ' seguro' : ''}`}
          aria-label={quitando ? 'Confirmar que se borra tu comentario' : 'Borrar tu comentario'}
          onClick={() => {
            tap()
            if (quitando) removeComentario(c.id)
            else setQuitando(true)
          }}
        >
          {quitando ? '¿Seguro?' : <Icono nombre="papelera" className="g" />}
        </button>
      )}
    </div>
  )
}
