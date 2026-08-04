import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, listDishes, addDish, updateDish, removeDish, DISH_CATEGORIES } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Fab from '../components/Fab.jsx'
import Recado from '../components/Recado.jsx'
import Ingredientes from '../components/Ingredientes.jsx'
import { normalizarIngredientes, sinCantidad } from '../lib/receta.js'
import { arreglarIngredientes, platosParecidos } from '../sync/api.js'

/**
 * «Platos»: el catálogo, que hasta ahora no tenía pantalla.
 *
 * La única alta era el «plato nuevo al vuelo» de dentro del modal de una cena, y
 * `updateDish`/`removeDish` llevaban desde el primer día en `db.js` **sin que los
 * llamara nadie**: un plato mal escrito se quedaba mal escrito para siempre. Y
 * como el catálogo es global entre eventos (tabla `dishes`, sin `eventId`), la
 * errata viajaba a todos los viajes.
 *
 * Eso último es justo lo que hay que decir en voz alta aquí, porque no se ve:
 * borrar un plato lo borra para todos los eventos. Por eso el borrado avisa de
 * en cuántas cenas está metido antes de hacerlo.
 */
const etiqueta = (id) => DISH_CATEGORIES.find((c) => c.id === id)?.label ?? id

export default function PlatosScreen({ event }) {
  const platos = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])
  // Todas las cenas de todos los eventos: es lo que hace falta para poder decir
  // «este plato está en tres cenas» antes de borrarlo.
  const cenas = useLiveQuery(() => db.dinners.toArray(), [], [])
  const [editando, setEditando] = useState(null) // el plato, o 'nuevo'

  const usosDe = (id) => cenas.filter((c) => c.platoIds?.includes(id)).length

  // Por categoría y en el orden de la comida, que es como se piensa un menú.
  const grupos = DISH_CATEGORIES
    .map((c) => ({ cat: c, lista: platos.filter((p) => p.categorias?.includes(c.id)) }))
    .filter((g) => g.lista.length > 0)
  const sinCategoria = platos.filter((p) => !p.categorias?.length)

  return (
    <div className="body">
      <div className="note">
        El catálogo es <b>el mismo en todos los eventos</b>: lo que se apunte aquí estará
        también en el viaje que viene.
      </div>

      {platos.length === 0 && (
        <div className="empty">
          <span className="e">🍳</span>El catálogo está vacío.<br />
          Apunta el primero con «+ Plato».<br />
          Alguien tendrá que decir qué se cena el martes.
        </div>
      )}

      {grupos.map(({ cat, lista }) => (
        <div key={cat.id}>
          <div className="sec-h">{cat.label}</div>
          <div className="card tight">
            {lista.map((p) => (
              <FilaPlato key={p.id} plato={p} usos={usosDe(p.id)} onEditar={() => setEditando(p)} />
            ))}
          </div>
        </div>
      ))}

      {sinCategoria.length > 0 && (
        <div>
          <div className="sec-h">Sin tipo</div>
          <div className="card tight">
            {sinCategoria.map((p) => (
              <FilaPlato key={p.id} plato={p} usos={usosDe(p.id)} onEditar={() => setEditando(p)} />
            ))}
          </div>
        </div>
      )}

      {/* El recado del viaje, al final del scroll (SPECS §14.22). */}
      <Recado evento={event} />

      <Fab label="Plato" onClick={() => setEditando('nuevo')} />
      {editando && (
        <ModalPlato
          // La clave cambia al coger una propuesta, para que el editor vuelva a
          // nacer con lo propuesto puesto en vez de conservar lo que hubiera.
          key={editando === 'nuevo' ? 'nuevo' : (editando.id ?? editando.name)}
          plato={editando === 'nuevo' ? null : editando}
          usos={editando === 'nuevo' || !editando.id ? 0 : usosDe(editando.id)}
          catalogo={platos}
          onClose={() => setEditando(null)}
          // Coger una propuesta **no guarda nada** (Q4): reabre el editor con el
          // nombre, el tipo y los ingredientes ya puestos, para corregirlo antes
          // de que exista. Sin `id`, así que al guardar nace un plato nuevo.
          onProponer={(p) => setEditando({
            name: p.que,
            categorias: [p.tipo],
            raciones: 12,
            ingredientes: p.ingredientes,
          })}
        />
      )}
    </div>
  )
}

function FilaPlato({ plato, usos, onEditar }) {
  return (
    <div className="row fila-plato">
      <button
        className="estrella"
        aria-label={plato.esFavorito ? `Quitar ${plato.name} de favoritos` : `Marcar ${plato.name} como favorito`}
        aria-pressed={!!plato.esFavorito}
        onClick={() => { tap(); updateDish(plato.id, { esFavorito: !plato.esFavorito }) }}
      >
        {plato.esFavorito ? '⭐' : '☆'}
      </button>
      <div className="main">
        <div className="n">{plato.name}</div>
        <div className="sub">
          {plato.categorias?.map(etiqueta).join(' · ') || 'sin tipo'}
          {usos > 0 ? ` · en ${usos} ${usos === 1 ? 'cena' : 'cenas'}` : ''}
        </div>
      </div>
      <button className="verbo-fila" aria-label={`Editar ${plato.name}`} onClick={() => { tap(); onEditar() }}>
        <Icono nombre="lapiz" />
      </button>
    </div>
  )
}

/**
 * Las cinco propuestas, para ir adelante y atrás (§14.20-bis · P2 · Q2+Q3+Q4).
 *
 * La figura es la del regalo de `garciadoral-ops`: **una tanda de cinco de una
 * vez**, porque lo caro de la llamada no es el texto sino contarle el contexto
 * —una vez contado, pasar de una a otra no vuelve a pedir nada—. Cada una trae
 * **qué** y **por qué**, que es lo que deja decidir sin abrirla.
 *
 * Y al cogerla **no se guarda nada todavía**: se abre el editor con el nombre,
 * el tipo y los ingredientes ya puestos, para corregirlo antes de que exista.
 */
function Propuestas({ lista, i, onIr, onCerrar, onCoger }) {
  const p = lista[i]
  return (
    <div className="propuesta" style={{ marginTop: 12 }}>
      <div className="propuesta-texto">
        <div className="propuesta-que">{p.que}</div>
        {p.porque && <div className="propuesta-porque">{p.porque}</div>}
        {p.ingredientes?.length > 0 && (
          <div className="propuesta-porque">{p.ingredientes.map((x) => x.nombre).join(' · ')}</div>
        )}
      </div>
      <div className="propuesta-pie">
        <button className="btn sm ghost" aria-label="La anterior" disabled={i === 0} onClick={() => { tap(); onIr(i - 1) }}>‹</button>
        <span className="propuesta-cuenta tnum">{i + 1} de {lista.length}</span>
        <button className="btn sm ghost" aria-label="La siguiente" disabled={i === lista.length - 1} onClick={() => { tap(); onIr(i + 1) }}>›</button>
        <button className="btn sm" onClick={() => { tap(); onCoger(p) }}>Coger esta</button>
        <button className="btn sm ghost" onClick={() => { tap(); onCerrar() }}>Dejarlo</button>
      </div>
    </div>
  )
}

function ModalPlato({ plato, usos, catalogo = [], onClose, onProponer }) {
  useBloqueoDeScroll()
  const [name, setName] = useState(plato?.name ?? '')
  const [cats, setCats] = useState(() => new Set(plato?.categorias ?? []))
  const [raciones, setRaciones] = useState(plato?.raciones ? String(plato.raciones) : '')
  const [ingredientes, setIngredientes] = useState(() => normalizarIngredientes(plato?.ingredientes))
  const [confirmando, setConfirmando] = useState(false)
  // La IA: null en reposo · 'yendo' mientras pregunta · el motivo si falló.
  const [ia, setIa] = useState(null)
  // Cómo estaba la lista antes de arreglarla, para poder deshacer (R1).
  const [antesDelArreglo, setAntes] = useState(null)
  // Las cinco propuestas y por cuál vamos (P2).
  const [propuestas, setPropuestas] = useState(null)

  const conNombre = ingredientes.filter((x) => x.nombre.trim())

  /**
   * Ordena la lista escrita a saco (§14.20-bis · R1).
   *
   * «tres pinchos de wagyu» sale como `3 ud` + «Pinchos de wagyu». Se aplica
   * directamente porque un toque es mejor que dos, y **se puede deshacer**
   * mientras no se guarde: eso es lo único que hace falta para poder pulsarlo
   * sin miedo. Lo tocado queda marcado hasta que alguien cambie el número.
   */
  async function arreglar() {
    tap()
    setIa('yendo')
    try {
      const puestas = await arreglarIngredientes({
        plato: name.trim(),
        raciones: Number(raciones) || null,
        lineas: conNombre.map((x) => ({ cantidad: x.cantidad, nombre: x.nombre })),
      })
      if (!puestas.length) {
        setIa('No ha sabido ordenar ninguna línea.')
        return
      }
      setAntes(ingredientes)
      const porIndice = new Map(puestas.map((x) => [x.i, x]))
      setIngredientes(conNombre.map((x, i) => {
        const p = porIndice.get(i)
        return p ? { ...x, nombre: p.nombre, cantidad: p.cantidad, unidad: p.unidad, deIA: true } : x
      }))
      setIa(null)
    } catch (e) {
      setIa(String(e.message ?? e))
    }
  }

  /** Cinco platos que peguen con este, para ir adelante y atrás (P2). */
  async function pedirParecidos() {
    tap()
    setIa('yendo')
    try {
      const platos = await platosParecidos({
        plato: name.trim(),
        ingredientes: conNombre.map((x) => x.nombre),
        yaHay: catalogo.map((d) => d.name),
      })
      setPropuestas(platos.length ? { lista: platos, i: 0 } : null)
      setIa(platos.length ? null : 'No se le ha ocurrido ninguno.')
    } catch (e) {
      setIa(String(e.message ?? e))
    }
  }

  function alternar(id) {
    const s = new Set(cats); s.has(id) ? s.delete(id) : s.add(id); setCats(s)
  }

  async function guardar() {
    const n = name.trim()
    if (!n) return
    const campos = {
      name: n,
      categorias: [...cats],
      raciones: Number(raciones) > 0 ? Number(raciones) : null,
      ingredientes: normalizarIngredientes(ingredientes),
    }
    if (plato) await updateDish(plato.id, campos)
    else await addDish(campos, event)
    onClose()
  }

  async function borrar() {
    await removeDish(plato.id)
    onClose()
  }


  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{plato ? 'Editar plato' : 'Plato nuevo'}</h2>

        {/* El orden es el de lo que se toca: el nombre ya está bien casi
            siempre, la lista es a lo que se entra, las raciones se afinan
            **mirando la lista** y el tipo se pone una vez en la vida del
            plato. Por eso el tipo va al final. */}
        <label htmlFor="plato-nombre">Nombre</label>
        <input
          id="plato-nombre"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tortilla de patata"
          autoFocus={!plato}
        />

        <label>Ingredientes</label>
        {/* Al editar un plato que ya existe, el foco entra aquí: editar un
            plato es casi siempre tocarle la lista. */}
        <Ingredientes
          valor={ingredientes}
          raciones={Number(raciones) || null}
          onCambiar={(x) => { setIngredientes(x); setAntes(null) }}
          autoFocus={Boolean(plato)}
        />

        <div className="editor-pie">
          <button className="btn ghost" disabled={ia === 'yendo' || !conNombre.length} onClick={arreglar}>
            {ia === 'yendo' ? 'Un momento…' : '🐳 Arreglar'}
          </button>
          <button className="btn ghost" disabled={ia === 'yendo' || (!name.trim() && !conNombre.length)} onClick={pedirParecidos}>
            🐳 Parecidos
          </button>
        </div>
        {antesDelArreglo && (
          <div className="pista" role="status" style={{ marginTop: 8 }}>
            Ordenada con la IA.{' '}
            <button className="como-enlace" onClick={() => { tap(); setIngredientes(antesDelArreglo); setAntes(null) }}>
              deshacer
            </button>
          </div>
        )}
        {propuestas && (
          <Propuestas
            {...propuestas}
            onIr={(i) => setPropuestas({ ...propuestas, i })}
            onCerrar={() => setPropuestas(null)}
            onCoger={(p) => { setPropuestas(null); onProponer(p) }}
          />
        )}
        {ia && ia !== 'yendo' && <pre className="traza mal" role="status">{ia}</pre>}

        <label htmlFor="plato-raciones">Para cuántas raciones</label>
        <input
          id="plato-raciones"
          type="text"
          inputMode="numeric"
          className="tnum"
          value={raciones}
          onChange={(e) => setRaciones(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="12"
        />
        <div className="pista">Es la receta, no el viaje: la app la estira sola para la gente que haya.</div>

        <label>Tipo <span className="apunte">(puede ser más de uno)</span></label>
        <div className="chips">
          {DISH_CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`chip${cats.has(c.id) ? ' on' : ''}`}
              aria-pressed={cats.has(c.id)}
              onClick={() => alternar(c.id)}
            >{c.label}</button>
          ))}
        </div>


        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={guardar} disabled={!name.trim()}>
            {plato ? 'Guardar' : 'Añadir al catálogo'}
          </button>
        </div>

        {plato && (
          <div style={{ marginTop: 10 }}>
            {confirmando ? (
              <>
                <div className="note">
                  Se borra <b>de todos los eventos</b>
                  {usos > 0 ? `, y está metido en ${usos} ${usos === 1 ? 'cena' : 'cenas'}` : ''}.
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="btn sm danger" onClick={borrar}>Sí, borrarlo</button>
                  <button className="btn sm ghost" onClick={() => setConfirmando(false)}>Dejarlo</button>
                </div>
              </>
            ) : (
              <button className="btn sm ghost block" onClick={() => setConfirmando(true)}>Borrar plato</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
