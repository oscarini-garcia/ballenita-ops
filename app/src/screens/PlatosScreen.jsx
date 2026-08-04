import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, listDishes, addDish, updateDish, removeDish, DISH_CATEGORIES } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Fab from '../components/Fab.jsx'
import Recado from '../components/Recado.jsx'
import Ingredientes from '../components/Ingredientes.jsx'
import BotonIA from '../components/BotonIA.jsx'
import { useIaDisponible } from '../lib/ia.js'
import { normalizarIngredientes, sinCantidad, juntarCantidad } from '../lib/receta.js'
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
          event={event}
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
 * Las cinco propuestas, **en un modal y una por pantalla** (§14.20-ter · M2).
 *
 * Decidido en [`docs/diseño/receta-fina.html`](../../../docs/diseño/receta-fina.html)
 * · **M2 · A1 + A2**.
 *
 * La figura de la tanda es la del regalo de `garciadoral-ops`: **cinco de una
 * vez**, porque lo caro de la llamada no es el texto sino contarle el contexto
 * —una vez contado, pasar de una a otra no vuelve a pedir nada—.
 *
 * Lo que ha cambiado es dónde salen. Antes salían **inline**, en una tarjeta de
 * 242,4 pt encajada entre los botones y «Para cuántas raciones», y ahí solo
 * caben tres renglones: el nombre, el porqué y **los ingredientes como una
 * ristra de nombres separados por puntos, sin sus cantidades**. Pero lo que
 * llega del modelo es una receta entera, y una receta se decide mirándola. Ahora
 * es un modal, se ve una a la vez con sus cantidades, y **dice desde el primer
 * momento que está cargando** en vez de dejar la pantalla quieta.
 *
 * Y se puede hacer dos cosas con la que te gusta: **añadirla como plato nuevo**
 * (A1), que deja el plato desde el que llamaste sin tocar, o **sustituir la
 * receta abierta** (A2). La segunda avisa de en cuántas cenas está metido ese
 * plato antes de hacerlo, con el mismo criterio con el que borrar ya lo dice:
 * cambiar la receta cambia lo que se cena esas noches.
 */
function ModalParecidos({ cargando, lista, i, usos, onIr, onCerrar, onNuevo, onSustituir }) {
  useBloqueoDeScroll()
  const [confirmando, setConfirmando] = useState(false)
  const p = lista?.[i]

  return (
    <div className="modal-bg" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onCerrar} aria-label="Cerrar">×</button>

        {cargando && (
          <div role="status">
            <h2>Buscando platos parecidos</h2>
            <div className="pista">Con lo que lleva este plato y lo que ya hay en el catálogo.</div>
            <div className="esqueletos" aria-hidden="true">
              <span className="esqueleto corta" />
              <span className="esqueleto larga" />
              <span className="esqueleto media" />
            </div>
          </div>
        )}

        {p && (
          <>
            <h2>{p.que}</h2>
            <div className="propuesta-cuenta tnum">{i + 1} de {lista.length}</div>
            {p.porque && <div className="pista">{p.porque}</div>}
            {/* Un renglón y no dos pastillas: esto se lee, no se toca, y un
                `.chip` encendido se lee como algo que está elegido. */}
            <div className="pista">{etiqueta(p.tipo)} · para 12 raciones</div>

            {p.ingredientes?.length > 0 && (
              <div className="card tight lista-ing" style={{ marginTop: 12 }}>
                {p.ingredientes.map((x, j) => (
                  <div className="fila-ing leida" key={`p-${j}`}>
                    <span className="ing-cant tnum">{juntarCantidad(x) || '—'}</span>
                    <span className="ing-nombre">{x.nombre}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="propuesta-pie" style={{ marginTop: 12 }}>
              <button className="btn sm ghost" aria-label="La anterior" disabled={i === 0} onClick={() => { tap(); setConfirmando(false); onIr(i - 1) }}>‹</button>
              <button className="btn sm ghost" aria-label="La siguiente" disabled={i === lista.length - 1} onClick={() => { tap(); setConfirmando(false); onIr(i + 1) }}>›</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn block" onClick={() => { tap(); onNuevo(p) }}>Añadir como plato nuevo</button>
            </div>

            {confirmando ? (
              <div style={{ marginTop: 10 }}>
                <div className="note">
                  Se escribe <b>encima de la receta abierta</b>
                  {usos > 0 ? `, y ese plato está metido en ${usos} ${usos === 1 ? 'cena' : 'cenas'}: cambia lo que se cena esas noches` : ''}.
                  {' '}Todavía no se guarda nada.
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="btn sm" onClick={() => { tap(); onSustituir(p) }}>Sí, sustituirla</button>
                  <button className="btn sm ghost" onClick={() => { tap(); setConfirmando(false) }}>Dejarlo</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <button className="btn sm ghost block" onClick={() => { tap(); setConfirmando(true) }}>Sustituir esta receta</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ModalPlato({ plato, event, usos, catalogo = [], onClose, onProponer }) {
  useBloqueoDeScroll()
  const [name, setName] = useState(plato?.name ?? '')
  const [cats, setCats] = useState(() => new Set(plato?.categorias ?? []))
  const [raciones, setRaciones] = useState(plato?.raciones ? String(plato.raciones) : '')
  const [ingredientes, setIngredientes] = useState(() => normalizarIngredientes(plato?.ingredientes))
  const [confirmando, setConfirmando] = useState(false)
  // **Quién** está pensando, no «hay algo pensando» (§14.20-ter · P1): con una
  // sola variable el texto colgaba del botón de «Arreglar» y pulsar «Parecidos»
  // hacía hablar a su vecino.
  const [pensando, setPensando] = useState(null) // 'arreglar' · 'parecidos' · null
  const [fallo, setFallo] = useState(null)
  // Cómo estaba la lista antes de arreglarla, para poder deshacer (R1).
  const [antesDelArreglo, setAntes] = useState(null)
  // Las cinco propuestas y por cuál vamos. `lista: null` es «todavía cargando»,
  // que es lo que el modal enseña desde el primer momento (M2).
  const [parecidos, setParecidos] = useState(null)
  // Qué llamada es la que vale: cerrar el modal mientras carga tiene que dejar
  // fuera la respuesta que venga después, no reabrirlo solo.
  const vuelta = useRef(0)
  const ia = useIaDisponible()

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
    setPensando('arreglar')
    setFallo(null)
    try {
      const puestas = await arreglarIngredientes({
        plato: name.trim(),
        raciones: Number(raciones) || null,
        lineas: conNombre.map((x) => ({ cantidad: x.cantidad, nombre: x.nombre })),
      })
      if (!puestas.length) {
        setFallo('No ha sabido ordenar ninguna línea.')
        return
      }
      setAntes(ingredientes)
      const porIndice = new Map(puestas.map((x) => [x.i, x]))
      setIngredientes(conNombre.map((x, i) => {
        const p = porIndice.get(i)
        return p ? { ...x, nombre: p.nombre, cantidad: p.cantidad, unidad: p.unidad, deIA: true } : x
      }))
    } catch (e) {
      setFallo(String(e.message ?? e))
    } finally {
      setPensando(null)
    }
  }

  /** Cinco platos que peguen con este, en su modal y desde el primer momento (M2). */
  async function pedirParecidos() {
    tap()
    const mia = vuelta.current + 1
    vuelta.current = mia
    setPensando('parecidos')
    setFallo(null)
    setParecidos({ lista: null, i: 0 })
    try {
      const platos = await platosParecidos({
        plato: name.trim(),
        ingredientes: conNombre.map((x) => x.nombre),
        yaHay: catalogo.map((d) => d.name),
        // Para que las propuestas se puedan cocinar con lo que hay en este
        // viaje: barbacoa, plancha… (§14.20-quater).
        eventId: event?.id ?? null,
      })
      if (vuelta.current !== mia) return
      if (!platos.length) {
        setParecidos(null)
        setFallo('No se le ha ocurrido ninguno.')
        return
      }
      setParecidos({ lista: platos, i: 0 })
    } catch (e) {
      if (vuelta.current !== mia) return
      setParecidos(null)
      setFallo(String(e.message ?? e))
    } finally {
      if (vuelta.current === mia) setPensando(null)
    }
  }

  /** Cerrar el modal descarta la llamada que venga después (M2). */
  function cerrarParecidos() {
    vuelta.current += 1
    setParecidos(null)
    setPensando(null)
  }

  /**
   * Sustituir la receta abierta por la propuesta (A2).
   *
   * No guarda: escribe encima de lo que hay en el editor y se sale del modal,
   * para poder corregirlo antes de que exista. Y **borra el deshacer** de
   * «Arreglar», que guarda una sola foto de la lista: dejarlo puesto ofrecería
   * volver a una receta que ya no es la de este plato.
   */
  function sustituir(p) {
    setName(p.que)
    setCats(new Set([p.tipo]))
    setRaciones('12')
    setIngredientes(normalizarIngredientes(p.ingredientes))
    setAntes(null)
    cerrarParecidos()
  }

  function alternar(id) {
    const s = new Set(cats); s.has(id) ? s.delete(id) : s.add(id); setCats(s)
  }

  // Una propuesta cogida (A1) llega **sin `id`**: tiene nombre y receta pero no
  // existe todavía. Sin esto el editor decía «Editar plato», ofrecía borrarlo, y
  // «Guardar» llamaba a `updateDish(undefined, …)`, así que no nacía nada.
  const esNuevo = !plato?.id

  async function guardar() {
    const n = name.trim()
    if (!n) return
    const campos = {
      name: n,
      categorias: [...cats],
      raciones: Number(raciones) > 0 ? Number(raciones) : null,
      ingredientes: normalizarIngredientes(ingredientes),
    }
    if (esNuevo) await addDish(campos, event)
    else await updateDish(plato.id, campos)
    onClose()
  }

  async function borrar() {
    await removeDish(plato.id)
    onClose()
  }


  return (
    <>
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{esNuevo ? 'Plato nuevo' : 'Editar plato'}</h2>

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
          <BotonIA
            pensando={pensando === 'arreglar'}
            disabled={Boolean(pensando) || !ia.puede || !conNombre.length}
            onClick={arreglar}
          >🐳 Arreglar</BotonIA>
          <BotonIA
            pensando={pensando === 'parecidos'}
            disabled={Boolean(pensando) || !ia.puede || (!name.trim() && !conNombre.length)}
            onClick={pedirParecidos}
          >🐳 Parecidos</BotonIA>
        </div>
        {/* Por qué están apagados, dicho en palabras y no con el error del
            transporte cuando ya es tarde (§14.20-ter, arreglo 1). */}
        {ia.motivo && <div className="pista" style={{ marginTop: 8 }}>{ia.motivo}</div>}
        {antesDelArreglo && (
          <div className="pista" role="status" style={{ marginTop: 8 }}>
            Ordenada con la IA.{' '}
            <button className="como-enlace" onClick={() => { tap(); setIngredientes(antesDelArreglo); setAntes(null) }}>
              deshacer
            </button>
          </div>
        )}
        {fallo && <pre className="traza mal" role="status">{fallo}</pre>}

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
            {esNuevo ? 'Añadir al catálogo' : 'Guardar'}
          </button>
        </div>

        {!esNuevo && (
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

    {parecidos && (
      <ModalParecidos
        cargando={parecidos.lista === null}
        lista={parecidos.lista}
        i={parecidos.i}
        usos={usos}
        onIr={(i) => setParecidos({ ...parecidos, i })}
        onCerrar={cerrarParecidos}
        // Añadir como plato nuevo **no guarda nada** (A1): reabre el editor con
        // el nombre, el tipo y los ingredientes puestos y sin `id`, así que al
        // guardar nace un plato y el que estabas mirando se queda como estaba.
        onNuevo={(p) => { cerrarParecidos(); onProponer(p) }}
        onSustituir={sustituir}
      />
    )}
    </>
  )
}
