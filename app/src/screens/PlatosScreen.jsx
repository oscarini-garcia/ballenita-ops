import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, listDishes, addDish, updateDish, removeDish, DISH_CATEGORIES } from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Fab from '../components/Fab.jsx'

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

export default function PlatosScreen() {
  const platos = useLiveQuery(listDishes, [], [])
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
          Apunta el primero con «+ Plato».
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

      <Fab label="Plato" onClick={() => setEditando('nuevo')} />
      {editando && (
        <ModalPlato
          plato={editando === 'nuevo' ? null : editando}
          usos={editando === 'nuevo' ? 0 : usosDe(editando.id)}
          onClose={() => setEditando(null)}
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

function ModalPlato({ plato, usos, onClose }) {
  useBloqueoDeScroll()
  const [name, setName] = useState(plato?.name ?? '')
  const [cats, setCats] = useState(() => new Set(plato?.categorias ?? []))
  const [ingredientes, setIngredientes] = useState((plato?.ingredientes ?? []).join(', '))
  const [confirmando, setConfirmando] = useState(false)

  function alternar(id) {
    const s = new Set(cats); s.has(id) ? s.delete(id) : s.add(id); setCats(s)
  }

  async function guardar() {
    const n = name.trim()
    if (!n) return
    const campos = {
      name: n,
      categorias: [...cats],
      ingredientes: ingredientes.split(',').map((x) => x.trim()).filter(Boolean),
    }
    if (plato) await updateDish(plato.id, campos)
    else await addDish(campos)
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

        <label htmlFor="plato-nombre">Nombre</label>
        <input
          id="plato-nombre"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tortilla de patata"
          autoFocus
        />

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

        <label htmlFor="plato-ingredientes">Ingredientes <span className="apunte">(separados por comas)</span></label>
        <input
          id="plato-ingredientes"
          type="text"
          value={ingredientes}
          onChange={(e) => setIngredientes(e.target.value)}
          placeholder="arroz, mejillones, pollo"
        />

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
